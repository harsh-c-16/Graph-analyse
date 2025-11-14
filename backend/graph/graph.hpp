#pragma once
#include <algorithm>
#include <map>
#include <mutex>
#include <shared_mutex>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>
#include "trie.hpp"
#include "dsu.hpp"


struct RankedUser {
    int first;            // user_id
    std::string second;   // username
    double third;         // score
};

struct PostInfo {
    int post_id;
    int user_id;
    int likes;
    std::string content;
};

class Graph {
public:
    Graph();
    ~Graph();

    // user management
    int add_user(const std::string &username);

    // posts & interactions
    int add_post(int user_id, const std::string &content);
    void add_follow(int a, int b);
    bool add_like(int user_id, int post_id);
    bool delete_post(int post_id);
    bool delete_user(int user_id);

    // persistence (simple file-based)
    void load_from_db(const std::string &path = "db/social_graph.db");
    void save_to_db(const std::string &path = "db/social_graph.db");
    void persist_user(int user_id, const std::string &username);
    void persist_post(int post_id, int user_id, const std::string &content);
    void persist_follow(int a, int b);
    void persist_like(int user_id, int post_id);

    // moderation
    bool moderate_content(const std::string &content);

    // analytics
    void recompute_analytics();
    std::vector<RankedUser> get_ranked(int page, int limit);
    std::vector<PostInfo> top_posts();
    std::vector<PostInfo> all_posts();
    
    // user metrics and queries
    struct UserMetrics {
        int followers = 0;
        int followings = 0;
        int posts = 0;
        int total_likes = 0;
        double score = 0.0;
    };
    UserMetrics get_user_metrics(int user_id);
    std::vector<int> get_followers(int user_id);
    std::vector<int> get_followings(int user_id);
    std::vector<int> get_liked_posts(int user_id);
    std::vector<int> get_user_posts(int user_id);

    // queries
    std::vector<std::pair<int,std::string>> users_list(int page, int limit);
    std::vector<int> bfs_path(int u1, int u2);
    std::vector<int> recommendations(int u);
    std::vector<std::pair<int,std::vector<int>>> communities();
    std::vector<int> community_members(int cid);
    std::vector<int> search_posts(const std::string &q);
    std::vector<std::string> autocomplete(const std::string &prefix);

private:
    std::shared_mutex mutex_;
    int next_user_id_ = 1;
    int next_post_id_ = 1;
    std::map<int,std::string> users_; // stable ordering for pagination

    struct Post { int id; int user_id; std::string content; std::unordered_set<int> likes; };
    std::map<int, Post> posts_;

    // follow graph: user -> set of followers (incoming) and followees (outgoing)
    std::unordered_map<int,std::unordered_set<int>> followers_; // who follows the user
    std::unordered_map<int,std::unordered_set<int>> followees_; // who the user follows

    // inverted index: token -> set of post ids
    std::unordered_map<std::string,std::unordered_set<int>> inverted_index_;

    // computed analytics
    std::unordered_map<int,double> pagerank_scores_;

    // file path for persistence (used by simple file-based persistence)
    std::string db_path_;
    
    // Trie for username autocomplete (Person 2's data structure)
    Trie username_trie_;
    
    // Trie for post content autocomplete (Person 2's data structure)
    Trie post_content_trie_;

    // helper
    std::vector<std::string> tokenize_lower(const std::string &s) const;
    double jaccard_sets(const std::unordered_set<int> &a, const std::unordered_set<int> &b) const;
};
