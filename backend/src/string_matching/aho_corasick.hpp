#pragma once
#include <string>
#include <vector>
#include <unordered_map>
#include <memory>

using namespace std;

struct AhoCorasick {
    struct Node {
        unordered_map<char, shared_ptr<Node>> children;
        shared_ptr<Node> fail;
        bool is_end = false;
        string pattern;
    };
    
    shared_ptr<Node> root;
    vector<string> patterns;
    
    AhoCorasick();
    void add_pattern(const string &pat);
    void build();
    vector<string> search(const string &text);
};
