#pragma once
#include <vector>
#include <unordered_map>

using namespace std;

// Person 4: Disjoint Set Union (Union-Find) Data Structure
// Used for efficient community detection in social graph
struct DSU {
    DSU(int n);
    
    // Find with path compression
    int find(int x);
    
    // Union by rank
    void unite(int a, int b);
    
    // Get all members of a component
    unordered_map<int, vector<int>> get_components();
    
    // Check if two nodes are in same component
    bool connected(int a, int b);
    
    // Get size of component
    int component_size(int x);
    
    vector<int> parent;
    vector<int> rank;
    vector<int> size;
};
