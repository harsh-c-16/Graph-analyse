#include "trie.hpp"
#include <cctype>
#include <algorithm>

using namespace std;

static string to_lowercase(const string &s) {
    string result;
    result.reserve(s.size());
    for (char c : s) {
        result.push_back(tolower(static_cast<unsigned char>(c)));
    }
    return result;
}

Trie::Trie() {
    root = make_shared<TrieNode>();
}

void Trie::insert(const string &s) {
    if (s.empty()) return;
    
    string lower_s = to_lowercase(s);
    shared_ptr<TrieNode> current = root;
    
    for (char c : lower_s) {
        if (current->children.find(c) == current->children.end()) {
            current->children[c] = make_shared<TrieNode>();
        }
        current = current->children[c];
    }
    
    current->is_end_of_word = true;
    current->complete_word = s;  
}

void Trie::dfs_collect(shared_ptr<TrieNode> node, vector<string> &results, int limit) {
    if (!node || (int)results.size() >= limit) return;
    
    if (node->is_end_of_word) {
        results.push_back(node->complete_word);
        if ((int)results.size() >= limit) return;
    }
    
    for (auto &pair : node->children) {
        dfs_collect(pair.second, results, limit);
        if ((int)results.size() >= limit) return;
    }
}

vector<string> Trie::autocomplete(const string &prefix, int limit) {
    vector<string> results;
    if (prefix.empty()) return results;
    
    string lower_prefix = to_lowercase(prefix);
    shared_ptr<TrieNode> current = root;
    
    for (char c : lower_prefix) {
        if (current->children.find(c) == current->children.end()) {
            return results;  // Prefix not found
        }
        current = current->children[c];
    }
    
    dfs_collect(current, results, limit);
    
    return results;
}

void Trie::clear() {
    root = make_shared<TrieNode>();
}
