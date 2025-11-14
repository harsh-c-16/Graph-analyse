#pragma once
#include <vector>
#include <unordered_map>

// Small helper algorithms that operate on the persistent DB file
// Implementations live in algorithms.cpp and read data from
// `db/social_graph.db` (relative to the backend working directory).

std::unordered_map<int,double> pagerank_bipartite();

std::vector<int> bfs_path(int u1, int u2);

// Returns top post IDs sorted by likes (descending)
std::vector<int> top_posts();

// Jaccard similarity between followee sets of user a and b
double jaccard_similarity(int a, int b);
