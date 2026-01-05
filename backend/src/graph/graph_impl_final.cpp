#include "graph.hpp"
#include "aho_corasick.hpp"
#include <algorithm>
#include <cctype>
#include <chrono>
#include <cmath>
#include <fstream>
#include <functional>
#include <iostream>
#include <limits>
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
    if (username_exists_unlocked(username)) return -1;
    int id = next_user_id_++;
    users_[id] = username;
    
    // Insert username into Trie for autocomplete
    username_trie_.insert(username);
    
    persist_user(id, username);
    return id;
}

int Graph::add_post(int user_id, const string &content) {
    unique_lock lock(mutex_);
    if (!user_exists_unlocked(user_id)) return -1;

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

bool Graph::add_follow(int a, int b) {
    unique_lock lock(mutex_);
    if (a == b || !user_exists_unlocked(a) || !user_exists_unlocked(b)) return false;
    const bool inserted = followees_[a].insert(b).second;
    followers_[b].insert(a);
    if (inserted) persist_follow(a, b);
    return true;
}

bool Graph::add_like(int user_id, int post_id, double weight, int64_t timestamp) {
    unique_lock lock(mutex_);
    if (!user_exists_unlocked(user_id) || weight <= 0.0) return false;
    auto it = posts_.find(post_id);
    if (it == posts_.end()) return false;
    int author = it->second.user_id;
    const auto followees_it = followees_.find(user_id);
    if (followees_it == followees_.end() || followees_it->second.find(author) == followees_it->second.end()) return false;
    if (timestamp <= 0) timestamp = current_epoch_seconds();
    auto &interaction = it->second.likes[user_id];
    const bool changed = interaction.timestamp != timestamp || interaction.weight != weight;
    interaction = {weight, timestamp};
    if (changed) persist_like(user_id, post_id, weight, timestamp);
    return true;
}

bool Graph::add_view(int user_id, int post_id, double weight, int64_t timestamp) {
    unique_lock lock(mutex_);
    if (!user_exists_unlocked(user_id) || weight <= 0.0) return false;
    auto it = posts_.find(post_id);
    if (it == posts_.end()) return false;
    if (timestamp <= 0) timestamp = current_epoch_seconds();

    auto &interaction = it->second.views[user_id];
    const bool changed = interaction.timestamp != timestamp || interaction.weight != weight;
    interaction = {weight, timestamp};
    it->second.unique_viewers.add(static_cast<uint64_t>(user_id));
    if (changed) persist_view(user_id, post_id, weight, timestamp);
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
    if (a.empty() && b.empty()) return 0.0;
    size_t inter = 0;
    for (int x : a) if (b.find(x) != b.end()) ++inter;
    size_t uni = a.size() + b.size() - inter;
    return uni ? (double)inter / (double)uni : 0.0;
}

int64_t Graph::current_epoch_seconds() {
    using namespace chrono;
    return duration_cast<seconds>(system_clock::now().time_since_epoch()).count();
}

double Graph::decay_factor(int64_t timestamp, int64_t now) {
    constexpr double half_life_seconds = 72.0 * 60.0 * 60.0;
    if (timestamp <= 0) return 1.0;
    const double age_seconds = static_cast<double>(max<int64_t>(0, now - timestamp));
    return exp(-log(2.0) * age_seconds / half_life_seconds);
}

bool Graph::user_exists_unlocked(int user_id) const {
    return users_.find(user_id) != users_.end();
}

bool Graph::username_exists_unlocked(const string &username) const {
    const string target = lower(username);
    return any_of(users_.begin(), users_.end(), [&](const auto &entry) {
        return lower(entry.second) == target;
    });
}

const unordered_set<int>& Graph::followees_for_unlocked(int user_id) const {
    static const unordered_set<int> empty;
    auto it = followees_.find(user_id);
    return it == followees_.end() ? empty : it->second;
}

const unordered_set<int>& Graph::followers_for_unlocked(int user_id) const {
    static const unordered_set<int> empty;
    auto it = followers_.find(user_id);
    return it == followers_.end() ? empty : it->second;
}

void Graph::rebuild_tries_and_index_unlocked() {
    username_trie_.clear();
    post_content_trie_.clear();
    inverted_index_.clear();

    for (const auto &u : users_) username_trie_.insert(u.second);
    for (const auto &p : posts_) {
        for (const auto &tok : tokenize_lower(p.second.content)) {
            inverted_index_[tok].insert(p.first);
            post_content_trie_.insert(tok);
        }
    }
}

void Graph::rebuild_unique_viewers_unlocked() {
    for (auto &p : posts_) {
        p.second.unique_viewers.clear();
        for (const auto &view : p.second.views) {
            p.second.unique_viewers.add(static_cast<uint64_t>(view.first));
        }
    }
}

double Graph::post_interaction_weight_unlocked(const Post &post, int64_t now) const {
    double total = 0.0;
    for (const auto &like : post.likes) {
        total += like.second.weight * decay_factor(like.second.timestamp, now);
    }
    for (const auto &view : post.views) {
        total += view.second.weight * decay_factor(view.second.timestamp, now);
    }
    return total;
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
    recompute_analytics_unlocked(current_epoch_seconds());
}

void Graph::recompute_analytics_unlocked(int64_t now) {
    pagerank_scores_.clear();
    post_pagerank_scores_.clear();
    post_interaction_weights_.clear();

    if (users_.empty()) {
        rebuild_top_k_unlocked();
        return;
    }

    vector<int> user_ids;
    user_ids.reserve(users_.size());
    for (const auto &u : users_) user_ids.push_back(u.first);

    vector<int> post_ids;
    post_ids.reserve(posts_.size());
    for (const auto &p : posts_) post_ids.push_back(p.first);

    const size_t user_count = user_ids.size();
    const size_t post_count = post_ids.size();
    const double damping = 0.85;
    const double epsilon = 1e-9;
    const int max_iterations = 200;

    unordered_map<int, double> user_scores;
    unordered_map<int, double> post_scores;
    unordered_map<int, double> outgoing_user_weight;

    for (int uid : user_ids) user_scores[uid] = 1.0 / static_cast<double>(user_count);
    if (post_count == 0) {
        pagerank_scores_ = user_scores;
        rebuild_top_k_unlocked();
        return;
    }

    for (int pid : post_ids) {
        post_scores[pid] = 1.0 / static_cast<double>(post_count);
        const double interaction_weight = post_interaction_weight_unlocked(posts_.at(pid), now);
        post_interaction_weights_[pid] = interaction_weight;
        for (const auto &like : posts_.at(pid).likes) {
            outgoing_user_weight[like.first] += like.second.weight * decay_factor(like.second.timestamp, now);
        }
        for (const auto &view : posts_.at(pid).views) {
            outgoing_user_weight[view.first] += view.second.weight * decay_factor(view.second.timestamp, now);
        }
    }

    for (int iteration = 0; iteration < max_iterations; ++iteration) {
        unordered_map<int, double> next_post_scores;
        double dangling_user_mass = 0.0;
        for (int uid : user_ids) {
            if (outgoing_user_weight[uid] <= 0.0) dangling_user_mass += user_scores[uid];
        }

        const double post_base =
            (1.0 - damping) / static_cast<double>(post_count) +
            damping * dangling_user_mass / static_cast<double>(post_count);
        for (int pid : post_ids) next_post_scores[pid] = post_base;

        for (int pid : post_ids) {
            const auto &post = posts_.at(pid);
            for (const auto &like : post.likes) {
                const double effective_weight =
                    like.second.weight * decay_factor(like.second.timestamp, now);
                if (effective_weight > 0.0 && outgoing_user_weight[like.first] > 0.0) {
                    next_post_scores[pid] +=
                        damping * user_scores[like.first] * effective_weight / outgoing_user_weight[like.first];
                }
            }
            for (const auto &view : post.views) {
                const double effective_weight =
                    view.second.weight * decay_factor(view.second.timestamp, now);
                if (effective_weight > 0.0 && outgoing_user_weight[view.first] > 0.0) {
                    next_post_scores[pid] +=
                        damping * user_scores[view.first] * effective_weight / outgoing_user_weight[view.first];
                }
            }
        }

        double boosted_sum = 0.0;
        for (int pid : post_ids) {
            const double unique_views = posts_.at(pid).unique_viewers.estimate();
            const double boost = 1.0 + 0.05 * log1p(max(0.0, unique_views));
            next_post_scores[pid] *= boost;
            boosted_sum += next_post_scores[pid];
        }
        if (boosted_sum > 0.0) {
            for (int pid : post_ids) next_post_scores[pid] /= boosted_sum;
        }

        unordered_map<int, double> next_user_scores;
        const double user_base = (1.0 - damping) / static_cast<double>(user_count);
        for (int uid : user_ids) next_user_scores[uid] = user_base;
        for (int pid : post_ids) {
            const int author = posts_.at(pid).user_id;
            if (user_exists_unlocked(author)) {
                next_user_scores[author] += damping * next_post_scores[pid];
            }
        }

        double delta = 0.0;
        for (int uid : user_ids) delta += fabs(next_user_scores[uid] - user_scores[uid]);
        for (int pid : post_ids) delta += fabs(next_post_scores[pid] - post_scores[pid]);

        user_scores.swap(next_user_scores);
        post_scores.swap(next_post_scores);
        if (delta < epsilon) break;
    }

    pagerank_scores_ = move(user_scores);
    post_pagerank_scores_ = move(post_scores);
    rebuild_top_k_unlocked();
}

Graph::UserMetrics Graph::get_user_metrics(int user_id) {
    shared_lock lock(mutex_);
    UserMetrics m;
    if (!users_.count(user_id)) return m;
    m.followers = (int)followers_for_unlocked(user_id).size();
    m.followings = (int)followees_for_unlocked(user_id).size();
    m.posts = 0; m.total_likes = 0;
    for (auto &p : posts_) if (p.second.user_id == user_id) { m.posts++; m.total_likes += (int)p.second.likes.size(); }
    m.score = pagerank_scores_.count(user_id) ? pagerank_scores_[user_id] : 0.0;
    return m;
}

vector<int> Graph::get_followers(int user_id) { shared_lock lock(mutex_); vector<int> out; for (int u : followers_for_unlocked(user_id)) out.push_back(u); sort(out.begin(), out.end()); return out; }
vector<int> Graph::get_followings(int user_id) { shared_lock lock(mutex_); vector<int> out; for (int u : followees_for_unlocked(user_id)) out.push_back(u); sort(out.begin(), out.end()); return out; }
vector<int> Graph::get_liked_posts(int user_id) { shared_lock lock(mutex_); vector<int> out; for (auto &p : posts_) if (p.second.likes.count(user_id)) out.push_back(p.second.id); return out; }
vector<int> Graph::get_user_posts(int user_id) { shared_lock lock(mutex_); vector<int> out; for (auto &p : posts_) if (p.second.user_id == user_id) out.push_back(p.second.id); return out; }

vector<RankedUser> Graph::get_ranked(int page, int limit) {
    shared_lock lock(mutex_);
    vector<RankedUser> all;
    for (auto &u : users_) { RankedUser r; r.first = u.first; r.second = u.second; r.third = pagerank_scores_.count(u.first) ? pagerank_scores_[u.first] : 0.0; all.push_back(r); }
    sort(all.begin(), all.end(), [](const RankedUser &a, const RankedUser &b){
        if (a.third != b.third) return a.third > b.third;
        return a.first < b.first;
    });
    int start = (page - 1) * limit; if (start < 0) start = 0; if (start >= (int)all.size()) return {};
    int end = min((int)all.size(), start + limit);
    return vector<RankedUser>(all.begin() + start, all.begin() + end);
}

vector<PostInfo> Graph::top_posts() {
    shared_lock lock(mutex_);
    auto heap = top_k_posts_;
    vector<PostInfo> out;
    out.reserve(heap.size());
    while (!heap.empty()) {
        const auto entry = heap.top();
        heap.pop();
        auto it = posts_.find(entry.post_id);
        if (it == posts_.end()) continue;
        out.push_back({
            it->second.id,
            it->second.user_id,
            static_cast<int>(it->second.likes.size()),
            static_cast<uint64_t>(llround(it->second.unique_viewers.estimate())),
            entry.score,
            post_interaction_weights_.count(entry.post_id) ? post_interaction_weights_.at(entry.post_id) : 0.0,
            it->second.content
        });
    }
    sort(out.begin(), out.end(), [](const PostInfo &a, const PostInfo &b){
        if (a.score != b.score) return a.score > b.score;
        return a.post_id < b.post_id;
    });
    return out;
}

vector<PostInfo> Graph::all_posts() {
    shared_lock lock(mutex_);
    vector<PostInfo> all;
    for (auto &p : posts_) {
        PostInfo pi;
        pi.post_id = p.second.id;
        pi.user_id = p.second.user_id;
        pi.likes = static_cast<int>(p.second.likes.size());
        pi.unique_views = static_cast<uint64_t>(llround(p.second.unique_viewers.estimate()));
        pi.score = post_pagerank_scores_.count(p.first) ? post_pagerank_scores_.at(p.first) : 0.0;
        pi.interaction_weight = post_interaction_weights_.count(p.first) ? post_interaction_weights_.at(p.first) : 0.0;
        pi.content = p.second.content;
        all.push_back(pi);
    }
    sort(all.begin(), all.end(), [](const PostInfo &a, const PostInfo &b){ return a.post_id < b.post_id; });
    return all;
}

void Graph::rebuild_top_k_unlocked() {
    top_k_posts_ = decltype(top_k_posts_)();
    for (const auto &p : posts_) {
        const double score = post_pagerank_scores_.count(p.first) ? post_pagerank_scores_.at(p.first) : 0.0;
        TrendingEntry entry{score, p.first};
        if (top_k_posts_.size() < top_k_limit_) {
            top_k_posts_.push(entry);
        } else {
            const auto &minimum = top_k_posts_.top();
            if (entry.score > minimum.score ||
                (entry.score == minimum.score && entry.post_id < minimum.post_id)) {
                top_k_posts_.pop();
                top_k_posts_.push(entry);
            }
        }
    }
}

bool Graph::delete_post(int post_id) {
    unique_lock lock(mutex_);
    auto it = posts_.find(post_id);
    if (it == posts_.end()) return false;
    for (auto &inv : inverted_index_) inv.second.erase(post_id);
    posts_.erase(it);
    rebuild_tries_and_index_unlocked();
    string path = db_path_.empty() ? string("db/social_graph.db") : db_path_;
    try {
        save_to_db_unlocked(path);
    } catch(...) {}
    return true;
}

vector<int> Graph::bfs_path(int u1, int u2) {
    shared_lock lock(mutex_);
    if (!user_exists_unlocked(u1) || !user_exists_unlocked(u2)) return {};
    if (u1 == u2) return {u1};
    queue<int> q; q.push(u1); unordered_map<int,int> par; par[u1] = -1;
    while (!q.empty()) {
        int u = q.front(); q.pop();
        for (int v : followees_for_unlocked(u)) {
            if (!par.count(v)) { par[v] = u; q.push(v); if (v == u2) break; }
        }
        if (par.count(u2)) break;
    }
    if (!par.count(u2)) return {};
    vector<int> path; for (int x = u2; x != -1; x = par[x]) path.push_back(x); reverse(path.begin(), path.end()); return path;
}

vector<int> Graph::recommendations(int u) {
    shared_lock lock(mutex_);
    if (!user_exists_unlocked(u)) return {};
    vector<pair<double,int>> scores;
    const auto &u_follow = followees_for_unlocked(u);
    for (auto &p : users_) {
        int v = p.first;
        if (v == u || u_follow.count(v)) continue;
        double sim = jaccard_sets(u_follow, followees_for_unlocked(v));
        if (sim > 0.0) scores.emplace_back(sim, v);
    }
    sort(scores.begin(), scores.end(), [](const auto &a, const auto &b){
        if (a.first != b.first) return a.first > b.first;
        return a.second < b.second;
    });
    vector<int> out;
    for (size_t i = 0; i < scores.size() && i < 10; ++i) out.push_back(scores[i].second);
    return out;
}

vector<pair<int,vector<int>>> Graph::communities() {
    shared_lock lock(mutex_);

    if (users_.empty()) return {};
    const int max_user_id = users_.rbegin()->first;
    int n = max_user_id + 1;
    DSU dsu(n);
    
    for (auto &a : users_) {
        for (auto &b : users_) {
            if (a.first < b.first) {
                double sim = jaccard_sets(followees_for_unlocked(a.first), followees_for_unlocked(b.first));
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
    auto comm = communities();
    for (auto &c : comm) if (c.first == cid) return c.second;
    return {};
}

Graph::PostMetrics Graph::get_post_metrics(int post_id) {
    shared_lock lock(mutex_);
    PostMetrics m;
    auto it = posts_.find(post_id);
    if (it == posts_.end()) return m;
    m.likes = static_cast<int>(it->second.likes.size());
    m.unique_views = static_cast<uint64_t>(llround(it->second.unique_viewers.estimate()));
    m.score = post_pagerank_scores_.count(post_id) ? post_pagerank_scores_.at(post_id) : 0.0;
    m.interaction_weight = post_interaction_weights_.count(post_id) ? post_interaction_weights_.at(post_id) : 0.0;
    return m;
}

vector<int> Graph::search_posts(const string &q) {
    shared_lock lock(mutex_);
    auto toks = tokenize_lower(q); if (toks.empty()) return {};
    auto first_it = inverted_index_.find(toks[0]);
    if (first_it == inverted_index_.end()) return {};
    unordered_set<int> res = first_it->second;
    for (size_t i = 1; i < toks.size(); ++i) {
        auto it = inverted_index_.find(toks[i]);
        if (it == inverted_index_.end()) return {};
        unordered_set<int> tmp;
        for (int pid : it->second) if (res.count(pid)) tmp.insert(pid);
        res.swap(tmp);
    }
    vector<int> out(res.begin(), res.end()); sort(out.begin(), out.end()); return out;
}

vector<string> Graph::autocomplete(const string &prefix) {
    shared_lock lock(mutex_);
    // Use Trie data structure for efficient prefix-based autocomplete
    // Returns both usernames and post keywords
    vector<string> results;
    
    // Get username matches
    auto user_matches = username_trie_.autocomplete(prefix, 5);
    results.insert(results.end(), user_matches.begin(), user_matches.end());
    
    // Get post content keyword matches
    auto post_matches = post_content_trie_.autocomplete(prefix, 5);
    results.insert(results.end(), post_matches.begin(), post_matches.end());
    
    sort(results.begin(), results.end());
    results.erase(unique(results.begin(), results.end()), results.end());
    if (results.size() > 10) results.resize(10);
    return results;
}

vector<string> Graph::autocomplete_users(const string &prefix) {
    shared_lock lock(mutex_);
    // Use Trie for username autocomplete only
    return username_trie_.autocomplete(prefix, 10);
}

vector<string> Graph::autocomplete_posts(const string &prefix) {
    shared_lock lock(mutex_);
    // Use Trie for post content keyword autocomplete
    return post_content_trie_.autocomplete(prefix, 10);
}

vector<int> Graph::search_posts_aho(const string &pattern) {
    shared_lock lock(mutex_);
    // Use Aho-Corasick for efficient multi-pattern matching in posts
    if (pattern.empty()) return {};
    
    AhoCorasick ac;
    // Add the search pattern (can be extended to multiple patterns)
    string low_pattern;
    for (char c : pattern) low_pattern.push_back(tolower((unsigned char)c));
    ac.add_pattern(low_pattern);
    ac.build();
    
    vector<int> matching_posts;
    for (auto &p : posts_) {
        string low_content;
        for (char c : p.second.content) low_content.push_back(tolower((unsigned char)c));
        auto matches = ac.search(low_content);
        if (!matches.empty()) {
            matching_posts.push_back(p.second.id);
        }
    }
    
    sort(matching_posts.begin(), matching_posts.end());
    return matching_posts;
}

void Graph::load_from_db(const string &path) {
    unique_lock lock(mutex_);
    db_path_ = path;

    users_.clear();
    posts_.clear();
    followers_.clear();
    followees_.clear();
    inverted_index_.clear();
    pagerank_scores_.clear();
    post_pagerank_scores_.clear();
    post_interaction_weights_.clear();
    next_user_id_ = 1;
    next_post_id_ = 1;
    username_trie_.clear();
    post_content_trie_.clear();
    
    ifstream in(path);
    if (!in) {
        rebuild_top_k_unlocked();
        return;
    }
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
        } else if (l[0] == 'P') {
            size_t p1 = l.find('|', 2);
            if (p1 == string::npos) continue;
            size_t p2 = l.find('|', p1 + 1);
            if (p2 == string::npos) continue;
            int id = stoi(l.substr(2, p1 - 2));
            int uid = stoi(l.substr(p1 + 1, p2 - (p1 + 1)));
            string content = l.substr(p2 + 1);
            Post p; p.id = id; p.user_id = uid; p.content = content; posts_[id] = p;
            
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
            size_t p2 = l.find('|', p1 + 1);
            int u = stoi(l.substr(2, p1 - 2));
            int p = 0;
            double weight = 3.0;
            int64_t timestamp = current_epoch_seconds();
            if (p2 == string::npos) {
                p = stoi(l.substr(p1 + 1));
            } else {
                p = stoi(l.substr(p1 + 1, p2 - (p1 + 1)));
                size_t p3 = l.find('|', p2 + 1);
                if (p3 == string::npos) {
                    weight = stod(l.substr(p2 + 1));
                } else {
                    weight = stod(l.substr(p2 + 1, p3 - (p2 + 1)));
                    timestamp = stoll(l.substr(p3 + 1));
                }
            }
            if (posts_.count(p)) posts_[p].likes[u] = {weight, timestamp};
        } else if (l[0] == 'V') {
            size_t p1 = l.find('|', 2);
            if (p1 == string::npos) continue;
            size_t p2 = l.find('|', p1 + 1);
            if (p2 == string::npos) continue;
            size_t p3 = l.find('|', p2 + 1);
            int u = stoi(l.substr(2, p1 - 2));
            int p = stoi(l.substr(p1 + 1, p2 - (p1 + 1)));
            double weight = 1.0;
            int64_t timestamp = current_epoch_seconds();
            if (p3 == string::npos) {
                weight = stod(l.substr(p2 + 1));
            } else {
                weight = stod(l.substr(p2 + 1, p3 - (p2 + 1)));
                timestamp = stoll(l.substr(p3 + 1));
            }
            if (posts_.count(p)) posts_[p].views[u] = {weight, timestamp};
        }
    }

    for (auto it = posts_.begin(); it != posts_.end();) {
        if (!user_exists_unlocked(it->second.user_id)) it = posts_.erase(it);
        else ++it;
    }
    for (auto it = followees_.begin(); it != followees_.end();) {
        if (!user_exists_unlocked(it->first)) {
            it = followees_.erase(it);
            continue;
        }
        for (auto jt = it->second.begin(); jt != it->second.end();) {
            if (!user_exists_unlocked(*jt)) jt = it->second.erase(jt);
            else ++jt;
        }
        ++it;
    }
    followers_.clear();
    for (const auto &f : followees_) {
        for (int v : f.second) followers_[v].insert(f.first);
    }
    for (auto &p : posts_) {
        for (auto it = p.second.likes.begin(); it != p.second.likes.end();) {
            if (!user_exists_unlocked(it->first)) it = p.second.likes.erase(it);
            else ++it;
        }
        for (auto it = p.second.views.begin(); it != p.second.views.end();) {
            if (!user_exists_unlocked(it->first)) it = p.second.views.erase(it);
            else ++it;
        }
    }
    rebuild_unique_viewers_unlocked();
    rebuild_tries_and_index_unlocked();
    recompute_analytics_unlocked(current_epoch_seconds());
}

void Graph::save_to_db(const string &path) {
    unique_lock lock(mutex_);
    save_to_db_unlocked(path);
}

void Graph::save_to_db_unlocked(const string &path) {
    try {
        auto parent = filesystem::path(path).parent_path();
        if (!parent.empty()) filesystem::create_directories(parent);
    } catch(...) {}
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
            for (const auto &like : p.second.likes) {
                int uid = like.first;
                if (users_.count(uid)) {
                    out << "L|" << uid << "|" << p.second.id << "|" << like.second.weight << "|" << like.second.timestamp << "\n";
                }
            }
            for (const auto &view : p.second.views) {
                int uid = view.first;
                if (users_.count(uid)) {
                    out << "V|" << uid << "|" << p.second.id << "|" << view.second.weight << "|" << view.second.timestamp << "\n";
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

void Graph::persist_like(int user_id, int post_id, double weight, int64_t timestamp) {
    if (db_path_.empty()) return;
    ofstream out(db_path_, ios::app);
    if (!out) return;
    out << "L|" << user_id << "|" << post_id << "|" << weight << "|" << timestamp << "\n";
}

void Graph::persist_view(int user_id, int post_id, double weight, int64_t timestamp) {
    if (db_path_.empty()) return;
    ofstream out(db_path_, ios::app);
    if (!out) return;
    out << "V|" << user_id << "|" << post_id << "|" << weight << "|" << timestamp << "\n";
}

bool Graph::delete_user(int user_id) {
    unique_lock lock(mutex_);
    if (!users_.count(user_id)) return false;
    users_.erase(user_id);
    for (auto &p : followees_) p.second.erase(user_id);
    for (auto &p : followers_) p.second.erase(user_id);
    followees_.erase(user_id);
    followers_.erase(user_id);
    for (auto &p : posts_) {
        p.second.likes.erase(user_id);
        p.second.views.erase(user_id);
    }
    vector<int> to_remove;
    for (auto &p : posts_) if (p.second.user_id == user_id) to_remove.push_back(p.first);
    for (int pid : to_remove) {
        for (auto &inv : inverted_index_) inv.second.erase(pid);
        posts_.erase(pid);
    }
    rebuild_unique_viewers_unlocked();
    rebuild_tries_and_index_unlocked();
    try {
        save_to_db_unlocked(db_path_.empty() ? "db/social_graph.db" : db_path_);
    } catch (const exception &e) {
        cerr << "ERR: delete_user persist exception: " << e.what() << endl;
        return false;
    }
    return true;
}
