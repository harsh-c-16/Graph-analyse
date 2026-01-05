#pragma once
#include <algorithm>
#include <cstdint>
#include <map>
#include <mutex>
#include <queue>
#include <shared_mutex>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>
#include "hll.hpp"
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
    std::uint64_t unique_views;
    double score;
    double interaction_weight;
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
    bool add_follow(int a, int b);
    bool add_like(int user_id, int post_id, double weight = 3.0, std::int64_t timestamp = 0);
    bool add_view(int user_id, int post_id, double weight = 1.0, std::int64_t timestamp = 0);
    bool delete_post(int post_id);
    bool delete_user(int user_id);

    // persistence (simple file-based)
    void load_from_db(const std::string &path = "db/social_graph.db");
    void save_to_db(const std::string &path = "db/social_graph.db");
    void persist_user(int user_id, const std::string &username);
    void persist_post(int post_id, int user_id, const std::string &content);
    void persist_follow(int a, int b);
    void persist_like(int user_id, int post_id, double weight, std::int64_t timestamp);
    void persist_view(int user_id, int post_id, double weight, std::int64_t timestamp);

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
    struct PostMetrics {
        int likes = 0;
        std::uint64_t unique_views = 0;
        double score = 0.0;
        double interaction_weight = 0.0;
    };
    UserMetrics get_user_metrics(int user_id);
    PostMetrics get_post_metrics(int post_id);
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
    std::vector<std::string> autocomplete_users(const std::string &prefix);
    std::vector<std::string> autocomplete_posts(const std::string &prefix);
    std::vector<int> search_posts_aho(const std::string &pattern);

private:
    std::shared_mutex mutex_;
    int next_user_id_ = 1;
    int next_post_id_ = 1;
    std::map<int,std::string> users_; // stable ordering for pagination

    struct WeightedInteraction {
        double weight = 0.0;
        std::int64_t timestamp = 0;
    };
    struct Post {
        int id = 0;
        int user_id = 0;
        std::string content;
        std::unordered_map<int, WeightedInteraction> likes;
        std::unordered_map<int, WeightedInteraction> views;
        HyperLogLog unique_viewers;
    };
    std::map<int, Post> posts_;

    // follow graph: user -> set of followers (incoming) and followees (outgoing)
    std::unordered_map<int,std::unordered_set<int>> followers_; // who follows the user
    std::unordered_map<int,std::unordered_set<int>> followees_; // who the user follows

    // inverted index: token -> set of post ids
    std::unordered_map<std::string,std::unordered_set<int>> inverted_index_;

    // computed analytics
    std::unordered_map<int,double> pagerank_scores_;      // user scores
    std::unordered_map<int,double> post_pagerank_scores_; // post scores
    std::unordered_map<int,double> post_interaction_weights_;

    struct TrendingEntry {
        double score = 0.0;
        int post_id = 0;
    };
    struct TrendingMinCompare {
        bool operator()(const TrendingEntry &a, const TrendingEntry &b) const {
            if (a.score != b.score) return a.score > b.score;
            return a.post_id < b.post_id;
        }
    };
    std::priority_queue<TrendingEntry, std::vector<TrendingEntry>, TrendingMinCompare> top_k_posts_;
    std::size_t top_k_limit_ = 10;

    // file path for persistence (used by simple file-based persistence)
    std::string db_path_;
    
    // Trie for username autocomplete (Person 2's data structure)
    Trie username_trie_;
    
    // Trie for post content autocomplete (Person 2's data structure)
    Trie post_content_trie_;

    // helper
    std::vector<std::string> tokenize_lower(const std::string &s) const;
    double jaccard_sets(const std::unordered_set<int> &a, const std::unordered_set<int> &b) const;
    bool username_exists_unlocked(const std::string &username) const;
    bool user_exists_unlocked(int user_id) const;
    const std::unordered_set<int>& followees_for_unlocked(int user_id) const;
    const std::unordered_set<int>& followers_for_unlocked(int user_id) const;
    void rebuild_tries_and_index_unlocked();
    void rebuild_unique_viewers_unlocked();
    void recompute_analytics_unlocked(std::int64_t now);
    void rebuild_top_k_unlocked();
    void save_to_db_unlocked(const std::string &path);
    static std::int64_t current_epoch_seconds();
    static double decay_factor(std::int64_t timestamp, std::int64_t now);
    double post_interaction_weight_unlocked(const Post &post, std::int64_t now) const;
};
