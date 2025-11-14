#include "dsu.hpp"

using namespace std;


DSU::DSU(int n): parent(n), rank(n, 0), size(n, 1) {
    for (int i = 0; i < n; ++i) {
        parent[i] = i;
    }
}

int DSU::find(int x) {
    if (parent[x] != x) {
        parent[x] = find(parent[x]); 
    }
    return parent[x];
}

void DSU::unite(int a, int b) {
    int root_a = find(a);
    int root_b = find(b);
    
    if (root_a == root_b) return;  
    
    if (rank[root_a] < rank[root_b]) {
        parent[root_a] = root_b;
        size[root_b] += size[root_a];
    } else if (rank[root_a] > rank[root_b]) {
        parent[root_b] = root_a;
        size[root_a] += size[root_b];
    } else {
        parent[root_b] = root_a;
        size[root_a] += size[root_b];
        rank[root_a]++;
    }
}

bool DSU::connected(int a, int b) {
    return find(a) == find(b);
}

int DSU::component_size(int x) {
    return size[find(x)];
}

unordered_map<int, vector<int>> DSU::get_components() {
    unordered_map<int, vector<int>> components;
    
    for (int i = 0; i < (int)parent.size(); ++i) {
        int root = find(i);
        components[root].push_back(i);
    }
    
    return components;
}
