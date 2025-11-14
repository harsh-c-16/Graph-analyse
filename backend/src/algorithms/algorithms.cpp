#include "algorithms.hpp"

#include <fstream>
#include <queue>
#include <set>
#include <sstream>
#include <string>
#include <unordered_set>
#include <algorithm>
#include <cmath>

using namespace std;

// Try to load DB from common relative paths. Returns true if loaded.
static bool load_db(
    unordered_map<int,string> &users,
    unordered_map<int,unordered_set<int>> &followees,
    unordered_map<int,unordered_set<int>> &followers,
    unordered_map<int,int> &post_author,
    unordered_map<int,unordered_set<int>> &post_likes
){
    vector<string> candidates = {"db/social_graph.db", "backend/db/social_graph.db"};
    string path;
    ifstream in;
    for (auto &p : candidates) {
        in.open(p);
        if (in) { path = p; break; }
    }
    if (!in) return false;

    string line;
    while (getline(in, line)) {
        if (line.empty()) continue;
        if (line[0] == 'U') {
            // U|id|name
            size_t p1 = line.find('|', 2);
            if (p1 == string::npos) continue;
            int id = stoi(line.substr(2, p1-2));
            string name = line.substr(p1+1);
            users[id] = name;
        } else if (line[0] == 'F') {
            size_t p1 = line.find('|', 2);
            if (p1 == string::npos) continue;
            int a = stoi(line.substr(2, p1-2));
            int b = stoi(line.substr(p1+1));
            followees[a].insert(b);
            followers[b].insert(a);
        } else if (line[0] == 'P') {
            // P|postid|userid|content
            size_t p1 = line.find('|', 2);
            if (p1 == string::npos) continue;
            size_t p2 = line.find('|', p1+1);
            if (p2 == string::npos) continue;
            int pid = stoi(line.substr(2, p1-2));
            int uid = stoi(line.substr(p1+1, p2-(p1+1)));
            post_author[pid] = uid;
        } else if (line[0] == 'L') {
            size_t p1 = line.find('|', 2);
            if (p1 == string::npos) continue;
            int uid = stoi(line.substr(2, p1-2));
            int pid = stoi(line.substr(p1+1));
            post_likes[pid].insert(uid);
        }
    }
    in.close();
    return true;
}

unordered_map<int,double> pagerank_bipartite() {
    // We'll compute a simple PageRank over the user follow graph
    unordered_map<int,string> users;
    unordered_map<int,unordered_set<int>> followees, followers;
    unordered_map<int,int> post_author;
    unordered_map<int,unordered_set<int>> post_likes;
    if (!load_db(users, followees, followers, post_author, post_likes)) return {};

    vector<int> nodes;
    nodes.reserve(users.size());
    for (auto &p : users) nodes.push_back(p.first);
    int N = (int)nodes.size();
    if (N == 0) return {};

    unordered_map<int,double> pr, pr_next;
    double init = 1.0 / (double)N;
    for (int u : nodes) pr[u] = init;

    const double damping = 0.85;
    const int ITER = 40;
    for (int it = 0; it < ITER; ++it) {
        double dangling_sum = 0.0;
        for (int u : nodes) {
            if (followees[u].empty()) dangling_sum += pr[u];
        }
        for (int u : nodes) pr_next[u] = (1.0 - damping) / (double)N + damping * dangling_sum / (double)N;
        for (int u : nodes) {
            if (followees[u].empty()) continue;
            double share = damping * pr[u] / (double)followees[u].size();
            for (int v : followees[u]) pr_next[v] += share;
        }
        // swap
        pr.swap(pr_next);
        for (auto &p : pr_next) p.second = 0.0;
    }
    return pr;
}

vector<int> bfs_path(int u1, int u2) {
    unordered_map<int,string> users;
    unordered_map<int,unordered_set<int>> followees, followers;
    unordered_map<int,int> post_author;
    unordered_map<int,unordered_set<int>> post_likes;
    if (!load_db(users, followees, followers, post_author, post_likes)) return {};
    if (u1 == u2 && users.count(u1)) return {u1};
    if (!users.count(u1) || !users.count(u2)) return {};

    queue<int> q;
    unordered_map<int,int> parent;
    q.push(u1); parent[u1] = -1;
    while (!q.empty()) {
        int u = q.front(); q.pop();
        for (int v : followees[u]) {
            if (!parent.count(v)) {
                parent[v] = u;
                if (v == u2) {
                    // reconstruct
                    vector<int> path;
                    for (int cur = u2; cur != -1; cur = parent[cur]) path.push_back(cur);
                    reverse(path.begin(), path.end());
                    return path;
                }
                q.push(v);
            }
        }
    }
    return {};
}

vector<int> top_posts() {
    unordered_map<int,string> users;
    unordered_map<int,unordered_set<int>> followees, followers;
    unordered_map<int,int> post_author;
    unordered_map<int,unordered_set<int>> post_likes;
    if (!load_db(users, followees, followers, post_author, post_likes)) return {};

    vector<pair<int,int>> v; // (likes, postid)
    for (auto &p : post_author) {
        int pid = p.first;
        int likes = (int)post_likes[pid].size();
        v.emplace_back(likes, pid);
    }
    sort(v.begin(), v.end(), [](const pair<int,int>&a,const pair<int,int>&b){
        if (a.first != b.first) return a.first > b.first;
        return a.second < b.second;
    });
    vector<int> out;
    for (size_t i=0;i<v.size() && i<10;++i) out.push_back(v[i].second);
    return out;
}

double jaccard_similarity(int a, int b) {
    unordered_map<int,string> users;
    unordered_map<int,unordered_set<int>> followees, followers;
    unordered_map<int,int> post_author;
    unordered_map<int,unordered_set<int>> post_likes;
    if (!load_db(users, followees, followers, post_author, post_likes)) return 0.0;
    const auto &A = followees[a];
    const auto &B = followees[b];
    if (A.empty() && B.empty()) return 1.0;
    size_t inter = 0;
    for (int x : A) if (B.find(x) != B.end()) ++inter;
    size_t uni = A.size() + B.size() - inter;
    return uni ? (double)inter / (double)uni : 0.0;
}

