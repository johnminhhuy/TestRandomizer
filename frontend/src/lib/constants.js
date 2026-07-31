export const VERDICTS = {
  AC: { label: "AC", color: "#22C55E", name: "Accepted" },
  WA: { label: "WA", color: "#EF4444", name: "Wrong Answer" },
  TLE: { label: "TLE", color: "#EAB308", name: "Time Limit Exceeded" },
  RTE: { label: "RTE", color: "#D946EF", name: "Runtime Error" },
  CE: { label: "CE", color: "#06B6D4", name: "Compilation Error" },
  MLE: { label: "MLE", color: "#F97316", name: "Memory Limit Exceeded" },
  ERR: { label: "ERR", color: "#A3A3A3", name: "Reference Error" },
};

export const DEFAULT_USER_CPP = `#include <bits/stdc++.h>
using namespace std;
int main(){
    int n; cin >> n;
    long long sum = 0;
    // BUG: off-by-one, skips the last element
    for (int i = 0; i < n - 1; i++) {
        long long x; cin >> x;
        sum += x;
    }
    cout << sum << "\\n";
    return 0;
}`;

export const DEFAULT_BRUTE_CPP = `#include <bits/stdc++.h>
using namespace std;
int main(){
    int n; cin >> n;
    long long sum = 0;
    for (int i = 0; i < n; i++) {
        long long x; cin >> x;
        sum += x;
    }
    cout << sum << "\\n";
    return 0;
}`;

export const DEFAULT_SIMPLE = {
  mode: "simple",
  variables: [{ name: "n", min: "1", max: "8" }],
  lines: [
    { kind: "vars", vars: ["n"] },
    { kind: "array", count: "n", min: "1", max: "20" },
  ],
};

export const DEFAULT_ADVANCED_TEMPLATE = `# Readable template DSL
# int(lo, hi)  -> random integer in [lo, hi]
# expressions can use variables & arithmetic (n, n-1, 2*n ...)
n = int(1, 8)
print(n)
array(n, 1, 20)`;
