## [LN] Playing with different DDs

### (Recommended, but can be difficult) Implement FDD in GV

FDD（Functional Decision Diagram）用的是 Davio decomposition 而不是 BDD 的 Shannon decomposition。Shannon 把函數拆成 \(f = x \cdot f|_{x=1} + \bar{x} \cdot f|_{x=0}\)，而正 Davio 拆成 \(f = f|_{x=0} \oplus x \cdot (f|_{x=0} \oplus f|_{x=1})\)。

要在 GV 裡實作 FDD，理論上可以基於 RicBDD 改寫 `ite` 操作，把 Shannon 換成 Davio。但實際做起來有幾個困難：

- RicBDD 的核心操作（`and`、`or`、`xor`）都是基於 Shannon decomposition 的 `ite`，改成 Davio 後所有操作都要重寫。
- FDD 的 canonical form 條件和 BDD 不同，reduction rule 也不一樣。
- OKFDD 更複雜——每個變數可以獨立選擇用 Shannon 或 Davio 分解。

我這次沒有實際完成 FDD 的實作，但理解了 FDD 在算術電路上可能更有效的理論基礎：XOR 在 Davio decomposition 下是一個節點，而在 Shannon BDD 下需要 3 個節點。所以 XOR-heavy 的電路（如 adder 的 sum bit）在 FDD 下會更小。

### Compare the sizes of DDs, especially on arithmetic circuits

雖然我沒有實作 FDD，但可以從理論上比較各種 DD 在算術電路上的表現：

| DD 類型 | Adder (n-bit) | Multiplier (n-bit) | 特點 |
|---------|--------------|-------------------|------|
| BDD (file order) | O(2^n) | O(2^(n/8)) lower bound | 通用，工具成熟 |
| BDD (interleaved) | O(n) | 仍然 exponential | 好的 variable order 可以大幅改善 |
| FDD | O(n) for sum bits | 仍然 exponential | XOR 只需 1 個節點 |
| \*BMD | O(n) | **O(n)** | 線性表示乘法器 |

BDD 對乘法器有已證明的指數下界，無論怎麼排變數都無法避免。\*BMD 是唯一能在線性大小表示乘法器的 DD 類型。

實際的 GV 實驗數據（BDD only）：

| 電路 | 4-bit 最大 PO | 8-bit 最大 PO | 成長倍數 |
|------|-------------|-------------|---------|
| adder (file) | 42 | 758 | 18x |
| adder (interleaved) | — | 24 | — |
| multiplier (file) | 47 | 2915 | 62x |
| counter | 5 | 9 | 1.8x |

### (Manual) \*BMD construction

\*BMD（Binary Moment Diagram）用多項式分解取代布林分支。基本思路是把每個布林變數 \(x_i \in \{0,1\}\) 當成一個數值，函數就變成一個多線性多項式。

**2-bit 乘法 \(z = a \cdot b\)：**

令 \(a = 2a_1 + a_0\)、\(b = 2b_1 + b_0\)，展開得：

\[z = (2a_1 + a_0)(2b_1 + b_0) = 4 a_1 b_1 + 2 a_1 b_0 + 2 a_0 b_1 + a_0 b_0\]

這是 4 個變數的多線性多項式，\*BMD 沿變數逐層展開，每層記錄常數項和線性項的係數。因為乘法展開後的多項式項數只有 O(n^2)（每個 a_i 配每個 b_j），\*BMD 可以用 O(n^2) 甚至 O(n) 的大小表示。

**3-bit 加法 \(s = a + b\)：**

令 \(a = 4a_2 + 2a_1 + a_0\)、\(b = 4b_2 + 2b_1 + b_0\)，則 \(s = a + b\) 直接就是線性多項式，\*BMD 只需要線性個節點。

**觀察**：算術函數天生適合 \*BMD，因為它們的語意本來就是數值運算（加、乘）。BDD 強制把所有東西壓成布林，反而引入了不必要的複雜度。

做 \*BMD 手動展開的過程讓我有一個很強的感覺：**選擇什麼 representation 就決定了問題有多難**。乘法在 \*BMD 的 moment 語意下就是一個多項式乘法，天然 compact；但在 BDD 的布林語意下，乘法需要逐位展開成一堆 AND/XOR，結構就爆開了。這跟程式語言裡「選對資料結構就解了一半」的道理是一樣的——在 formal verification 裡，「選對 DD 類型」也可以讓不可能的問題變成可解的。

/// collapse-code  
```text title="2-bit 和 3-bit 的 *BMD 多項式展開"
# 2-bit 乘法
a = 2*a1 + a0
b = 2*b1 + b0
z = a * b
  = 4*(a1*b1) + 2*(a1*b0) + 2*(a0*b1) + (a0*b0)
  → *BMD 只需記錄 4 個 moment 項

# 3-bit 加法
a = 4*a2 + 2*a1 + a0
b = 4*b2 + 2*b1 + b0
s = a + b = 4*(a2+b2) + 2*(a1+b1) + (a0+b0)
  → *BMD 只需記錄 6 個線性項
```
///

### Any creative research idea?

一個有趣的方向是做 **hybrid DD**：根據電路的不同部分自動選擇最適合的 DD 類型。例如，對 datapath 部分用 \*BMD（利用算術結構），對 control logic 部分用 BDD（通用性好）。這需要在不同 DD 表示之間做轉換，可能可以透過 compose 操作實現。

另一個想法是探索 **ZDD 在 SAT solving 輔助** 中的應用。ZDD 擅長表示稀疏集合族，而 SAT solver 的 learned clause database 本質上就是一個 clause 的集合族。如果能用 ZDD 壓縮 clause database，或許能加速 SAT solving 的某些步驟。
