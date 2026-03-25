# Week 4

## [LN] Exploring BDD constructions with different variable orders

### (Recommended) Support "BSETOrder &lt;DFS | RDFS&gt;" command options in GV

我查了 GV 目前的 `BSETOrder` 指令，發現只支援 `-file`（按 Verilog 檔案中 PI 的宣告順序）和 `-rfile`（反向檔案順序）。`-dfs` 和 `-rdfs` 還沒有被實作——這正是建議我們去做的功能。

概念上，DFS order 是從所有 PO 和 FF 輸入出發，沿著電路往回做 post-order DFS traversal，按遇到 PI 的順序排列。這樣的好處是：在同一個 cone 裡的 PI 會被排在一起，相關性高的變數自然相鄰，BDD 因此更容易共享子結構。

GV 的 `CirMgr::_dfsList` 其實已經存了這個順序，所以實作上只需要在 `BSetOrderCmd::exec()` 裡加一個 `-dfs` 分支，從 `_dfsList` 中過濾出 PI 類型的 gate，按出現順序設定 BDD 變數即可。`-rdfs` 就是把這個順序反過來。

目前我還沒有去改 GV 的原始碼，但理解了這個方法的原理。

### Modify the input order of the Verilog file

既然 GV 的 `bseto -file` 是照 Verilog 的 PI 宣告順序來排 BDD 變數，我可以直接改 Verilog 檔的 input 宣告順序來得到不同的 variable order。

我寫了一個 interleaved 版本的 8-bit adder，把 input 宣告改成 `a0, b0, a1, b1, ..., a7, b7`（而不是 `a[7:0], b[7:0]`），這樣 `bseto -file` 就會自動按交錯順序排列：

**8-bit adder — file order vs interleaved order：**

| PO | file order 節點數 | interleaved 節點數 |
|----|------------------|-------------------|
| sum[0] | 3 | 3 |
| sum[1] | 6 | 5 |
| sum[2] | 13 | 8 |
| sum[3] | 28 | 11 |
| sum[4] | 59 | 14 |
| sum[5] | 122 | 17 |
| sum[6] | 249 | 20 |
| sum[7] | 504 | 23 |
| cout | 758 | 24 |

差距非常驚人：file order 下 cout 要 758 個節點（指數成長），interleaved 只要 24 個（線性成長）。

原因是加法器的運算是 bit-wise aligned 的——第 i 位的 sum 和 carry 主要依賴同一位的 `a_i`、`b_i` 加上前一位的 carry。交錯順序讓相關的變數在 BDD 決策樹上早期就相鄰出現，BDD 可以最大化 subgraph sharing。而 file order 把所有 `a` 排前面、所有 `b` 排後面，延遲了同一位元的 `a` 和 `b` 的聯合決策，造成大量不可合併的子結構。

我也試了 GV 內建的 `bseto -rfile`（反向檔案順序）：

**8-bit adder — rfile order：**
節點數：3, 6, 12, 24, 48, 96, 192, 384, 511

比 file order 稍好（511 < 758），但仍然是指數成長，遠不如 interleaved 的 24。

看到 758 → 24 這個 30 倍的差距時我真的嚇到了——同一個電路、同一個 BDD engine，只是變數排列不同就可以差這麼多。這讓我深刻體會到 variable ordering 在 BDD-based verification 中有多關鍵。實務上如果 ordering 選錯了，BDD 可能直接 memory explosion 建不起來；選對了，同一個問題可能幾秒鐘就解完。

### Any creative idea?

一個有趣的方向是做 **自動化的 variable order 搜尋**。可以寫一個腳本來嘗試多種排列（file、rfile、interleaved、random permutation...），對每種排列跑 `bseto -file` + `bcons -all` 並記錄總節點數，最後挑最好的。

另一個想法是結合 **dynamic reordering**：先用任意順序建完 BDD，再套用 sifting 演算法把每個變數上下移動，看哪個位置讓總節點數最小。很多 BDD library（如 CUDD）有內建這個功能。GV 的 lecture note 也有提到 dynamic variable reordering（pp. 7–13）。

### Try different variable for different Boolean functions. Can you conclude with some "good" heuristics for BDD variable ordering?

我把 adder 和 multiplier 在不同順序下的結果整理如下：

**8-bit adder — 最大 PO 節點數比較：**

| 順序 | 最大節點數 | 成長模式 |
|------|----------|---------|
| file order | 758 | 指數 (~2.0x) |
| rfile order | 511 | 指數 (~2.0x) |
| interleaved | 24 | 線性 (~+3) |

**8-bit multiplier — 最大 PO 節點數比較：**

| 順序 | 最大節點數 |
|------|----------|
| file order | 2915 |
| rfile order | 3560 |

乘法器換順序後差距不像加法器那麼戲劇性，因為乘法器本身就有 exponential lower bound。

綜合以上實驗，我歸納出幾個 heuristic：

1. **相關變數要靠在一起**：像加法器的 `a_i` 和 `b_i` 是強相關的（它們一起決定第 i 位的 sum 和 carry），放在一起可以讓 BDD 有效共享子結構。
2. **從 PO 出發的拓撲順序通常不錯**：DFS post-order traversal 會讓同一個 cone 裡的 PI 靠在一起，效果類似於自動把相關變數分組。
3. **Bit-wise interleaving 對算術電路幾乎總是好的**：加法、減法等 bit-aligned 運算，交錯排列的效果遠優於分組排列。
4. **沒有萬能排序**：乘法器無論怎麼排都是指數級的。Variable ordering 能改善常數因子，但無法突破函數本身的 inherent complexity。



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
| *BMD | O(n) | **O(n)** | 線性表示乘法器 |

BDD 對乘法器有已證明的指數下界，無論怎麼排變數都無法避免。*BMD 是唯一能在線性大小表示乘法器的 DD 類型。

實際的 GV 實驗數據（BDD only）：

| 電路 | 4-bit 最大 PO | 8-bit 最大 PO | 成長倍數 |
|------|-------------|-------------|---------|
| adder (file) | 42 | 758 | 18x |
| adder (interleaved) | — | 24 | — |
| multiplier (file) | 47 | 2915 | 62x |
| counter | 5 | 9 | 1.8x |

### (Manual) *BMD construction

*BMD（Binary Moment Diagram）用多項式分解取代布林分支。基本思路是把每個布林變數 \(x_i \in \{0,1\}\) 當成一個數值，函數就變成一個多線性多項式。

**2-bit 乘法 \(z = a \cdot b\)：**

令 \(a = 2a_1 + a_0\)、\(b = 2b_1 + b_0\)，展開得：

\[z = (2a_1 + a_0)(2b_1 + b_0) = 4 a_1 b_1 + 2 a_1 b_0 + 2 a_0 b_1 + a_0 b_0\]

這是 4 個變數的多線性多項式，*BMD 沿變數逐層展開，每層記錄常數項和線性項的係數。因為乘法展開後的多項式項數只有 O(n^2)（每個 a_i 配每個 b_j），*BMD 可以用 O(n^2) 甚至 O(n) 的大小表示。

**3-bit 加法 \(s = a + b\)：**

令 \(a = 4a_2 + 2a_1 + a_0\)、\(b = 4b_2 + 2b_1 + b_0\)，則 \(s = a + b\) 直接就是線性多項式，*BMD 只需要線性個節點。

**觀察**：算術函數天生適合 *BMD，因為它們的語意本來就是數值運算（加、乘）。BDD 強制把所有東西壓成布林，反而引入了不必要的複雜度。

做 *BMD 手動展開的過程讓我有一個很強的感覺：**選擇什麼 representation 就決定了問題有多難**。乘法在 *BMD 的 moment 語意下就是一個多項式乘法，天然 compact；但在 BDD 的布林語意下，乘法需要逐位展開成一堆 AND/XOR，結構就爆開了。這跟程式語言裡「選對資料結構就解了一半」的道理是一樣的——在 formal verification 裡，「選對 DD 類型」也可以讓不可能的問題變成可解的。

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

一個有趣的方向是做 **hybrid DD**：根據電路的不同部分自動選擇最適合的 DD 類型。例如，對 datapath 部分用 *BMD（利用算術結構），對 control logic 部分用 BDD（通用性好）。這需要在不同 DD 表示之間做轉換，可能可以透過 compose 操作實現。

另一個想法是探索 **ZDD 在 SAT solving 輔助** 中的應用。ZDD 擅長表示稀疏集合族，而 SAT solver 的 learned clause database 本質上就是一個 clause 的集合族。如果能用 ZDD 壓縮 clause database，或許能加速 SAT solving 的某些步驟。
