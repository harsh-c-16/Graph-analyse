#include "aho_corasick.hpp"
#include <queue>

using namespace std;

AhoCorasick::AhoCorasick() : root(make_shared<Node>()) {}

void AhoCorasick::add_pattern(const string &pat) {
    if (pat.empty()) return;
    
    auto curr = root;
    for (char c : pat) {
        if (!curr->children.count(c)) {
            curr->children[c] = make_shared<Node>();
        }
        curr = curr->children[c];
    }
    curr->is_end = true;
    curr->pattern = pat;
    patterns.push_back(pat);
}

void AhoCorasick::build() {
    queue<shared_ptr<Node>> q;
    
    for (auto &[c, child] : root->children) {
        child->fail = root;
        q.push(child);
    }
    
    while (!q.empty()) {
        auto curr = q.front();
        q.pop();
        
        for (auto &[c, child] : curr->children) {
            q.push(child);
            
            auto fail_node = curr->fail;
            while (fail_node != root && !fail_node->children.count(c)) {
                fail_node = fail_node->fail;
            }
            
            if (fail_node->children.count(c) && fail_node->children[c] != child) {
                child->fail = fail_node->children[c];
            } else {
                child->fail = root;
            }
            
            if (child->fail->is_end) {
                child->is_end = true;
                if (child->pattern.empty()) {
                    child->pattern = child->fail->pattern;
                }
            }
        }
    }
}

vector<string> AhoCorasick::search(const string &text) {
    if (patterns.empty()) return {};
    
    vector<string> matches;
    auto curr = root;
    
    for (char c : text) {
        while (curr != root && !curr->children.count(c)) {
            curr = curr->fail;
        }
        
        if (curr->children.count(c)) {
            curr = curr->children[c];
        }
        
        if (curr->is_end) {
            matches.push_back(curr->pattern);
        }
    }
    
    return matches;
}
