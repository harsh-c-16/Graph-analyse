#pragma once
#include <string>
#include <vector>
#include <unordered_map>
#include <memory>

using namespace std;

// Person 2: Trie Data Structure Implementation
// Used for efficient prefix-based autocomplete for usernames and post content
struct TrieNode {
    unordered_map<char, shared_ptr<TrieNode>> children;
    bool is_end_of_word;
    string complete_word;
    
    TrieNode() : is_end_of_word(false) {}
};

struct Trie {
    shared_ptr<TrieNode> root;
    
    Trie();
    void insert(const string &s);
    vector<string> autocomplete(const string &prefix, int limit = 10);
    void clear();
    
private:
    void dfs_collect(shared_ptr<TrieNode> node, vector<string> &results, int limit);
};
