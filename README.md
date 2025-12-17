# DSA-Project — Social Network Graph Analysis Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![C++](https://img.shields.io/badge/C%2B%2B-17-blue)](https://en.wikipedia.org/wiki/C%2B%2B17)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)

A full-stack social network analysis platform demonstrating advanced graph algorithms and data structures. Features a high-performance C++ backend with RESTful API and modern React frontend.

## 🌟 Features

### Core Functionality
- **User Management**: Create and delete users with unique usernames
- **Social Graph**: Follow/unfollow users, create posts, like content
- **Shortest Path**: BFS algorithm to find connections between users
- **Recommendations**: Jaccard similarity-based friend suggestions
- **User Rankings**: Composite scoring (followers, likes, activity)
- **Community Detection**: DSU algorithm for social groups
- **Content Moderation**: Multi-layer vulgar content detection
- **Full-Text Search**: Inverted index with conjunctive queries
- **Autocomplete**: Fast prefix matching for usernames

### Data Structures & Algorithms
- **Graph Representation**: Adjacency list (unordered_map)
- **BFS**: Shortest path finding
- **Jaccard Similarity**: Recommendation engine
- **Disjoint Set Union (DSU)**: Community detection
- **Inverted Index**: Fast text search
- **Trie**: Autocomplete (stubbed)
- **Aho-Corasick**: Pattern matching (stubbed)

## 🚀 Quick Start

### Prerequisites
- **C++ Compiler**: g++ 7.0+ with C++17 support
- **Node.js**: v14+ with npm
- **Make**: For building backend

### Setup & Run

```bash
# Clone repository
git clone https://github.com/harsh-c-16/DSA-Project.git
cd DSA-Project

# Terminal 1: Start Backend
cd backend
make clean && make
./graph_engine        # Runs on port 8080

# Terminal 2: Start Frontend
cd frontend
npm install
npm start             # Opens http://localhost:3000
```

**Linux/Mac One-Liner:**
```bash
./start.sh
```

## 📁 Project Structure

```
DSA-Project/
├── backend/
│   ├── src/
│   │   ├── main.cpp              # HTTP server & API routes
│   │   ├── graph.hpp             # Graph class interface
│   │   ├── graph_impl_final.cpp  # Main graph implementation
│   │   ├── algorithms.cpp        # Stub algorithms
│   │   ├── dsu.cpp/hpp           # Disjoint Set Union
│   │   ├── trie.cpp/hpp          # Trie (stub)
│   │   └── aho_corasick.cpp/hpp  # Aho-Corasick (stub)
│   ├── Makefile                  # Build configuration
│   ├── db/                       # Persistent storage
│   └── graph_engine              # Compiled binary
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Main component
│   │   ├── pages/
│   │   │   ├── ManagementPage.jsx    # User/post management
│   │   │   └── AnalyticsPage.jsx     # Rankings & analytics
│   │   └── components/
│   │       ├── GraphManager.jsx      # Add users/posts/interactions
│   │       ├── UserList.jsx          # Paginated user list
│   │       ├── UserRanking.jsx       # User leaderboard
│   │       ├── TopPosts.jsx          # Most liked posts
│   │       ├── PathExplorer.jsx      # Find connections
│   │       ├── CommunityViewer.jsx   # Community detection
│   │       └── SearchBar.jsx         # Full-text search
│   ├── package.json
│   └── public/
│
├── start.sh                      # Quick start script
├── .gitignore
├── LICENSE
└── README.md                     # This file
```

## 🔧 API Endpoints

Backend server runs on **port 8080** with the following REST API:

### User Management
| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/user` | `username=<name>` | Create new user |
| POST | `/user/delete` | `user_id=<id>` | Delete user and cleanup |
| GET | `/users-list?page=1&limit=50` | - | Paginated user list |

### Posts & Interactions
| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/post` | `user_id=<id>&content=<text>` | Create post (with moderation) |
| POST | `/post/delete` | `post_id=<id>` | Delete post |
| POST | `/interaction` | `type=follow&user_id=<id>&target_id=<id>` | Follow user |
| POST | `/interaction` | `type=like&user_id=<id>&target_id=<post_id>` | Like post (requires follow) |
| GET | `/posts/all` | - | Get all posts |
| GET | `/posts/top10` | - | Top 10 posts by likes |

### Analytics & Graph Operations
| Method | Endpoint | Query | Description |
|--------|----------|-------|-------------|
| GET | `/users/ranked?page=1&limit=10` | - | User leaderboard |
| GET | `/path?u1=<id>&u2=<id>` | - | Shortest path (BFS) |
| GET | `/recommendations?u=<id>` | - | Friend suggestions (Jaccard) |
| GET | `/communities` | - | Detect communities (DSU) |
| GET | `/search?q=<keyword>` | - | Search posts (inverted index) |
| GET | `/autocomplete/user?prefix=<text>` | - | Username autocomplete |
| GET | `/user/metrics/<id>` | - | User statistics |
| GET | `/user/followers/<id>` | - | List followers |
| GET | `/user/followings/<id>` | - | List followings |

## �️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18.2 | UI framework |
| Styling | Tailwind CSS 3.4 | Utility-first CSS |
| HTTP Client | Axios 1.4 | API requests |
| Backend | C++17 | Graph engine |
| Build System | Make/g++ | Compilation |
| HTTP Server | Raw sockets | Single-threaded server |
| Storage | File-based DB | Pipe-delimited text |

## 🧪 Usage Example

### Sample Workflow
```bash
# 1. Create users
curl -X POST http://localhost:8080/user -d "username=Alice"
# Response: {"user_id":11,"username":"Alice"}

curl -X POST http://localhost:8080/user -d "username=Bob"
# Response: {"user_id":12,"username":"Bob"}

# 2. Create post
curl -X POST http://localhost:8080/post -d "user_id=11&content=Hello DSA!"
# Response: {"post_id":1}

# 3. Follow user
curl -X POST http://localhost:8080/interaction -d "type=follow&user_id=12&target_id=11"
# Response: {"status":"ok"}

# 4. Like post (must follow author first)
curl -X POST http://localhost:8080/interaction -d "type=like&user_id=12&target_id=1"
# Response: {"status":"ok"}

# 5. Get recommendations
curl http://localhost:8080/recommendations?u=12
# Response: [13,14,15] (user IDs)

# 6. Find path
curl http://localhost:8080/path?u1=11&u2=12
# Response: [11,12]
```

## 🎯 Key Algorithms Explained

### 1. **Jaccard Similarity (Recommendations)**
```
Similarity(A, B) = |A ∩ B| / |A ∪ B|
```
Compares follow sets to find users with similar interests.

### 2. **BFS (Shortest Path)**
```cpp
queue<int> q; q.push(start);
map<int,int> parent;
while (!q.empty()) {
    int u = q.front(); q.pop();
    for (int v : followees[u]) {
        if (!parent.count(v)) {
            parent[v] = u;
            q.push(v);
        }
    }
}
```

### 3. **DSU (Community Detection)**
```cpp
int find(int x) {
    return parent[x] == x ? x : parent[x] = find(parent[x]);
}
void unite(int a, int b) {
    parent[find(b)] = find(a);
}
```

### 4. **Composite Scoring (Rankings)**
```
score = 3 × followers + 2 × total_likes + 1 × followings + 0.5 × posts
```

## � Performance Notes

- **In-memory operations**: O(1) lookups with hash maps
- **BFS complexity**: O(V + E) where V = users, E = follows
- **Recommendations**: O(V²) for small graphs (<1000 users)
- **Storage format**: Pipe-delimited text file
- **Concurrency**: Reader-writer locks for thread safety

## 🐛 Troubleshooting

**Backend won't compile?**
```bash
g++ --version  # Should be 7.0+ for C++17
cd backend && make clean && make
```

**Port 8080 already in use?**
```bash
pkill graph_engine  # Kill old process
lsof -i :8080       # Check what's using the port
```

**Frontend can't connect?**
- Verify backend is running: `curl http://localhost:8080/users-list?page=1&limit=1`
- Check `frontend/package.json` has: `"proxy": "http://localhost:8080"`

**Data persistence?**
- Database saved to `backend/db/social_graph.db`
- Validated on save (orphaned records removed)
- Delete file to reset: `rm backend/db/social_graph.db`

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## � Acknowledgments

- Educational project demonstrating DSA concepts
- C++17 STL and modern React patterns
- Graph theory and social network analysis

---

**🚀 Ready to start?** Run `./start.sh` and visit http://localhost:3000
