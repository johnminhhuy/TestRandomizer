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

export const DEFAULT_SIMPLE_TEXT = `# SIMPLE TEMPLATE — describe your input in plain lines.
#   let n = 1..8            define a random number (reusable below)
#   print n                 write values on one line
#   list n ints in 1..20    n random ints  (add 'distinct' for unique)
#   list n chars in a-z     n random letters
#   word 5 in a-z           one random string of length 5
#   text YES                a fixed line of text

let n = 1..8
print n
list n ints in 1..20`;

export const SIMPLE_PRESETS = [
  { id: "array", label: "Array", text: `let n = 1..8\nprint n\nlist n ints in 1..20` },
  { id: "number", label: "One number", text: `let n = 1..1000\nprint n` },
  { id: "two", label: "Two numbers", text: `let a = 1..100\nlet b = 1..100\nprint a b` },
  { id: "distinct", label: "Distinct list", text: `let n = 1..8\nprint n\nlist n distinct ints in 1..50` },
  { id: "string", label: "String", text: `let n = 3..10\nprint n\nword n in a-z` },
];

export const ADVANCED_PRESETS = [
  { id: "array", label: "Array", template: `n = int(1, 10)\nprint(n)\narray(n, 1, 100)` },
  { id: "matrix", label: "Matrix", template: `r = int(1, 5)\nc = int(1, 5)\nprint(r, c)\ngrid(r, c, 0, 9)` },
  { id: "graph", label: "Graph edges", template: `n = int(2, 8)\nm = int(1, n*(n-1)//2)\nprint(n, m)\ngrid(m, 2, 1, n)` },
  { id: "two", label: "Two numbers", template: `a = int(1, 100)\nb = int(1, 100)\nprint(a, b)` },
];

export const DEFAULT_SIMPLE = {
  mode: "simple",
  variables: [{ name: "n", type: "int", min: "1", max: "8" }],
  lines: [
    { kind: "vars", vars: ["n"] },
    { kind: "array", count: "n", type: "int", min: "1", max: "20", distinct: false },
  ],
};

export const DEFAULT_ADVANCED_TEMPLATE = `# Readable template DSL
# int(lo, hi)  -> random integer in [lo, hi]
# expressions can use variables & arithmetic (n, n-1, 2*n ...)
n = int(1, 8)
print(n)
array(n, 1, 20)`;
