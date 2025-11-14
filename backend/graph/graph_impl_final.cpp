#include "graph.hpp"
#include "aho_corasick.hpp"
#include <algorithm>
#include <cctype>
#include <fstream>
#include <functional>
#include <iostream>
#include <queue>
#include <sstream>
#include <string>
#include <filesystem>
#include <unordered_set>
#include <unordered_map>
#include <vector>

using namespace std;

static string lower(const string &s) {
    string out;
    out.reserve(s.size());
    for (char c : s) out.push_back(tolower((unsigned char)c));
    return out;
}

Graph::Graph() {
    try { filesystem::create_directories("db"); } catch(...) {}
    load_from_db("db/social_graph.db");
}

Graph::~Graph() {
    save_to_db(db_path_.empty() ? "db/social_graph.db" : db_path_);
}

int Graph::add_user(const string &username) {
    unique_lock lock(mutex_);
    int id = next_user_id_++;
    users_[id] = username;
    
    // Insert username into Trie for autocomplete
    username_trie_.insert(username);
    
    persist_user(id, username);
    return id;
}

int Graph::add_post(int user_id, const string &content) {
    unique_lock lock(mutex_);
    int pid = next_post_id_++;
    Post p; p.id = pid; p.user_id = user_id; p.content = content;
    posts_[pid] = move(p);
    
    // Build inverted index for keyword search
    for (auto &tok : tokenize_lower(content)) {
        inverted_index_[tok].insert(pid);
        // Also insert tokens into Trie for autocomplete
        post_content_trie_.insert(tok);
    }
    
    persist_post(pid, user_id, content);
    return pid;
}

void Graph::add_follow(int a, int b) {
    unique_lock lock(mutex_);
    if (a == b) return;
    followees_[a].insert(b);
    followers_[b].insert(a);
    persist_follow(a, b);
}

bool Graph::add_like(int user_id, int post_id) {
    unique_lock lock(mutex_);
    auto it = posts_.find(post_id);
    if (it == posts_.end()) return false;
    int author = it->second.user_id;
    if (followees_[user_id].find(author) == followees_[user_id].end()) return false;
    it->second.likes.insert(user_id);
    persist_like(user_id, post_id);
    return true;
}

vector<pair<int,string>> Graph::users_list(int page, int limit) {
    shared_lock lock(mutex_);
    vector<pair<int,string>> out;
    for (auto &p : users_) out.emplace_back(p.first, p.second);
    int start = (page - 1) * limit;
    if (start < 0) start = 0;
    if (start >= (int)out.size()) return {};
    int end = min((int)out.size(), start + limit);
    return vector<pair<int,string>>(out.begin() + start, out.begin() + end);
}

vector<string> Graph::tokenize_lower(const string &s) const {
    vector<string> out;
    string cur;
    for (char c : s) {
        if (isalnum((unsigned char)c)) cur.push_back(tolower((unsigned char)c));
        else { if (!cur.empty()) { out.push_back(cur); cur.clear(); } }
    }
    if (!cur.empty()) out.push_back(cur);
    return out;
}

double Graph::jaccard_sets(const unordered_set<int> &a, const unordered_set<int> &b) const {
    if (a.empty() && b.empty()) return 1.0;
    size_t inter = 0;
    for (int x : a) if (b.find(x) != b.end()) ++inter;
    size_t uni = a.size() + b.size() - inter;
    return uni ? (double)inter / (double)uni : 0.0;
}

bool Graph::moderate_content(const string &content) {
    static AhoCorasick ac = []() {
        AhoCorasick a;
        vector<string> vulgar = {"badword", "vulgar", "shit", "fuck", "bitch", "asshole", "damn", "crap"};
        for (auto &word : vulgar) a.add_pattern(word);
        a.build();
        return a;
    }();
    
    string low = lower(content);
    auto matches = ac.search(low);
    if (!matches.empty()) return true;

    string cleaned;
    cleaned.reserve(low.size());
    for (char c : low) cleaned.push_back(isalnum((unsigned char)c) ? c : ' ');
    istringstream iss(cleaned);
    string tok;
    while (iss >> tok) {
        auto tok_matches = ac.search(tok);
        if (!tok_matches.empty()) return true;
    }
    string letters; letters.reserve(cleaned.size());
    for (char c : cleaned) if (isalpha((unsigned char)c)) letters.push_back(c);
    auto letter_matches = ac.search(letters);
    if (!letter_matches.empty()) return true;
    return false;
}

void Graph::recompute_analytics() {
    unique_lock lock(mutex_);
    pagerank_scores_.clear();
    for (auto &u : users_) {
        int uid = u.first;
        int followers_cnt = (int)followers_[uid].size();
        int followings_cnt = (int)followees_[uid].size();
        int total_likes = 0;
        int posts_cnt = 0;
        for (auto &pp : posts_) if (pp.second.user_id == uid) { total_likes += (int)pp.second.likes.size(); posts_cnt++; }
        double score = 3.0 * followers_cnt + 2.0 * total_likes + 1.0 * followings_cnt + 0.5 * posts_cnt;
        pagerank_scores_[uid] = score;
    }
}

Graph::UserMetrics Graph::get_user_metrics(int user_id) {
    shared_lock lock(mutex_);
    UserMetrics m;
    if (!users_.count(user_id)) return m;
    m.followers = (int)followers_[user_id].size();
    m.followings = (int)followees_[user_id].size();
    m.posts = 0; m.total_likes = 0;
    for (auto &p : posts_) if (p.second.user_id == user_id) { m.posts++; m.total_likes += (int)p.second.likes.size(); }
    m.score = pagerank_scores_.count(user_id) ? pagerank_scores_[user_id] : 0.0;
    return m;
}

vector<int> Graph::get_followers(int user_id) { shared_lock lock(mutex_); vector<int> out; for (int u : followers_[user_id]) out.push_back(u); return out; }
vector<int> Graph::get_followings(int user_id) { shared_lock lock(mutex_); vector<int> out; for (int u : followees_[user_id]) out.push_back(u); return out; }
vector<int> Graph::get_liked_posts(int user_id) { shared_lock lock(mutex_); vector<int> out; for (auto &p : posts_) if (p.second.likes.count(user_id)) out.push_back(p.second.id); return out; }
vector<int> Graph::get_user_posts(int user_id) { shared_lock lock(mutex_); vector<int> out; for (auto &p : posts_) if (p.second.user_id == user_id) out.push_back(p.second.id); return out; }

vector<RankedUser> Graph::get_ranked(int page, int limit) {
    shared_lock lock(mutex_);
    vector<RankedUser> all;
    for (auto &u : users_) { RankedUser r; r.first = u.first; r.second = u.second; r.third = pagerank_scores_.count(u.first) ? pagerank_scores_[u.first] : 0.0; all.push_back(r); }
    sort(all.begin(), all.end(), [](const RankedUser &a, const RankedUser &b){ return a.third > b.third; });
    int start = (page - 1) * limit; if (start < 0) start = 0; if (start >= (int)all.size()) return {};
    int end = min((int)all.size(), start + limit);
    return vector<RankedUser>(all.begin() + start, all.begin() + end);
}

vector<PostInfo> Graph::top_posts() {
    shared_lock lock(mutex_);
    vector<PostInfo> all;
    for (auto &p : posts_) { PostInfo pi; pi.post_id = p.second.id; pi.user_id = p.second.user_id; pi.likes = p.second.likes.size(); pi.content = p.second.content; all.push_back(pi); }
    sort(all.begin(), all.end(), [](const PostInfo &a, const PostInfo &b){ return a.likes > b.likes; });
    if (all.size() > 10) all.resize(10);
    return all;
}

vector<PostInfo> Graph::all_posts() {
    shared_lock lock(mutex_);
    vector<PostInfo> all;
    for (auto &p : posts_) { PostInfo pi; pi.post_id = p.second.id; pi.user_id = p.second.user_id; pi.likes = p.second.likes.size(); pi.content = p.second.content; all.push_back(pi); }
    sort(all.begin(), all.end(), [](const PostInfo &a, const PostInfo &b){ return a.post_id < b.post_id; });
    return all;
}

bool Graph::delete_post(int post_id) {
    unique_lock lock(mutex_);
    auto it = posts_.find(post_id);
    if (it == posts_.end()) return false;
    for (auto &inv : inverted_index_) inv.second.erase(post_id);
    posts_.erase(it);
    string path = db_path_.empty() ? string("db/social_graph.db") : db_path_;
    lock.unlock();
    try {
        save_to_db(path);
    } catch(...) {}
    return true;
}

vector<int> Graph::bfs_path(int u1, int u2) {
    shared_lock lock(mutex_);
    if (u1 == u2) return {u1};
    queue<int> q; q.push(u1); unordered_map<int,int> par; par[u1] = -1;
    while (!q.empty()) {
        int u = q.front(); q.pop();
        for (int v : followees_[u]) {
            if (!par.count(v)) { par[v] = u; q.push(v); if (v == u2) break; }
        }
        if (par.count(u2)) break;
    }
    if (!par.count(u2)) return {};
    vector<int> path; for (int x = u2; x != -1; x = par[x]) path.push_back(x); reverse(path.begin(), path.end()); return path;
}

vector<int> Graph::recommendations(int u) {
    shared_lock lock(mutex_);
    vector<pair<double,int>> scores; auto &u_follow = followees_[u];
    for (auto &p : users_) { int v = p.first; if (v == u) continue; if (u_follow.count(v)) continue; double sim = jaccard_sets(u_follow, followees_[v]); scores.emplace_back(sim, v); }
    sort(scores.begin(), scores.end(), [](auto &a, auto &b){ return a.first > b.first; }); vector<int> out;
    for (size_t i = 0; i < scores.size() && i < 10; ++i) out.push_back(scores[i].second);
    return out;
}

vector<pair<int,vector<int>>> Graph::communities() {
    shared_lock lock(mutex_);
    
    int n = next_user_id_ + 5;
    DSU dsu(n);
    
    for (auto &a : users_) {
        for (auto &b : users_) {
            if (a.first < b.first) {
                double sim = jaccard_sets(followees_[a.first], followees_[b.first]);
                if (sim > 0.1) {
                    dsu.unite(a.first, b.first);
                }
            }
        }
    }
    
    auto components = dsu.get_components();
    
    vector<pair<int,vector<int>>> out;
    for (auto &comp : components) {
        vector<int> members;
        for (int uid : comp.second) {
            if (users_.count(uid)) {
                members.push_back(uid);
            }
        }
        if (!members.empty()) {
            out.emplace_back(comp.first, members);
        }
    }
    
    return out;
}

vector<int> Graph::community_members(int cid) {
    shared_lock lock(mutex_);
    auto comm = communities(); for (auto &c : comm) if (c.first == cid) return c.second; return {};
}

vector<int> Graph::search_posts(const string &q) {
    shared_lock lock(mutex_);
    auto toks = tokenize_lower(q); if (toks.empty()) return {};
    unordered_set<int> res = inverted_index_[toks[0]];
    for (size_t i = 1; i < toks.size(); ++i) { unordered_set<int> tmp; for (int pid : inverted_index_[toks[i]]) if (res.count(pid)) tmp.insert(pid); res.swap(tmp); }
    vector<int> out(res.begin(), res.end()); sort(out.begin(), out.end()); return out;
}

vector<string> Graph::autocomplete(const string &prefix) {
    shared_lock lock(mutex_);
    // Use Trie data structure for efficient prefix-based autocomplete
    return username_trie_.autocomplete(prefix, 10);
}

void Graph::load_from_db(const string &path) {
    unique_lock lock(mutex_);
    db_path_ = path;
    
    // Clear Tries before rebuilding
    username_trie_.clear();
    post_content_trie_.clear();
    
    ifstream in(path);
    if (!in) return;
    string l;
    while (getline(in, l)) {
        if (l.empty()) continue;
        if (l[0] == 'U') {
            size_t p1 = l.find('|', 2);
            if (p1 == string::npos) continue;
            int id = stoi(l.substr(2, p1 - 2));
            string name = l.substr(p1 + 1);
            users_[id] = name; 
            next_user_id_ = max(next_user_id_, id + 1);
            
            username_trie_.insert(name);
            
        } else if (l[0] == 'P') {
            size_t p1 = l.find('|', 2);
            if (p1 == string::npos) continue;
            size_t p2 = l.find('|', p1 + 1);
            if (p2 == string::npos) continue;
            int id = stoi(l.substr(2, p1 - 2));
            int uid = stoi(l.substr(p1 + 1, p2 - (p1 + 1)));
            string content = l.substr(p2 + 1);
            Post p; p.id = id; p.user_id = uid; p.content = content; posts_[id] = p;
            
            for (auto &tok : tokenize_lower(content)) {
                inverted_index_[tok].insert(id);
                post_content_trie_.insert(tok);
            }
            
            next_post_id_ = max(next_post_id_, id + 1);
        } else if (l[0] == 'F') {
            size_t p1 = l.find('|', 2);
            if (p1 == string::npos) continue;
            int a = stoi(l.substr(2, p1 - 2));
            int b = stoi(l.substr(p1 + 1));
            followees_[a].insert(b); followers_[b].insert(a);
        } else if (l[0] == 'L') {
            size_t p1 = l.find('|', 2);
            if (p1 == string::npos) continue;
            int u = stoi(l.substr(2, p1 - 2));
            int p = stoi(l.substr(p1 + 1));
            if (posts_.count(p)) posts_[p].likes.insert(u);
        }
    }
}

void Graph::save_to_db(const string &path) {
    unique_lock lock(mutex_);
    ofstream out(path, ios::trunc);
    if (!out) return;
    for (auto &u : users_) out << "U|" << u.first << "|" << u.second << "\n";
    for (auto &p : posts_) {
        if (users_.count(p.second.user_id)) {
            out << "P|" << p.second.id << "|" << p.second.user_id << "|" << p.second.content << "\n";
        }
    }
    for (auto &f : followees_) {
        if (!users_.count(f.first)) continue;
        for (int v : f.second) {
            if (users_.count(v)) {
                out << "F|" << f.first << "|" << v << "\n";
            }
        }
    }
    for (auto &p : posts_) {
        if (users_.count(p.second.user_id)) {
            for (int uid : p.second.likes) {
                if (users_.count(uid)) {
                    out << "L|" << uid << "|" << p.second.id << "\n";
                }
            }
        }
    }
}

void Graph::persist_user(int user_id, const string &username) {
    if (db_path_.empty()) return;
    ofstream out(db_path_, ios::app);
    if (!out) return;
    out << "U|" << user_id << "|" << username << "\n";
}

void Graph::persist_post(int post_id, int user_id, const string &content) {
    if (db_path_.empty()) return;
    ofstream out(db_path_, ios::app);
    if (!out) return;
    out << "P|" << post_id << "|" << user_id << "|" << content << "\n";
}

void Graph::persist_follow(int a, int b) {
    if (db_path_.empty()) return;
    ofstream out(db_path_, ios::app);
    if (!out) return;
    out << "F|" << a << "|" << b << "\n";
}

void Graph::persist_like(int user_id, int post_id) {
    if (db_path_.empty()) return;
    ofstream out(db_path_, ios::app);
    if (!out) return;
    out << "L|" << user_id << "|" << post_id << "\n";
}

bool Graph::delete_user(int user_id) {
    bool existed = false;
    {
        unique_lock lock(mutex_);
        if (!users_.count(user_id)) return false;
        existed = true;
        users_.erase(user_id);
        for (auto &p : followees_) p.second.erase(user_id);
        for (auto &p : followers_) p.second.erase(user_id);
        followees_.erase(user_id);
        followers_.erase(user_id);
        for (auto &p : posts_) p.second.likes.erase(user_id);
        vector<int> to_remove;
        for (auto &p : posts_) if (p.second.user_id == user_id) to_remove.push_back(p.first);
        for (int pid : to_remove) {
            for (auto &inv : inverted_index_) inv.second.erase(pid);
            posts_.erase(pid);
        }
    }
    if (existed) {
        try {
            cerr << "DBG: delete_user persist start for " << user_id << endl;
            save_to_db(db_path_.empty() ? "db/social_graph.db" : db_path_);
            cerr << "DBG: delete_user persist done for " << user_id << endl;
        } catch (const exception &e) {
            cerr << "ERR: delete_user persist exception: " << e.what() << endl;
            return false;
        }
    }
    return true;
}
