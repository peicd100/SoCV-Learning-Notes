# Week 4

## [LN] Exploring BDD constructions with different variable orders

### (Recommended) Support "BSETOrder &lt;DFS | RDFS&gt;" command options in GV

我查了 GV 目前的 `BSETOrder` 指令，發現只支援 `-file`（按 Verilog 檔案中 PI 的宣告順序）和 `-rfile`（反向檔案順序）。`-dfs` 和 `-rdfs` 還沒有被實作，這正是建議我們去做的功能。

概念上，DFS order 是從所有 PO 和 FF 輸入出發，沿著電路往回做 post-order DFS traversal，按遇到 PI 的順序排列。這樣的好處是：在同一個 cone 裡的 PI 會被排在一起，相關性高的變數自然相鄰，BDD 因此更容易共享子結構。

GV 的 `CirMgr::_dfsList` 其實已經存了這個順序，所以實作上只需要在 `BSetOrderCmd::exec()` 裡加一個 `-dfs` 分支，從 `_dfsList` 中過濾出 PI 類型的 gate，按出現順序設定 BDD 變數即可。`-rdfs` 就是把這個順序反過來。

目前我還沒有去改 GV 的原始碼，但理解了這個方法的原理。

### Modify the input order of the Verilog file

既然 GV 的 `bseto -file` 是照 Verilog 的 PI 宣告順序來排 BDD 變數，我可以直接改 Verilog 檔的 input 宣告順序來得到不同的 variable order。

我寫了一個 interleaved 版本的 8-bit adder，把 input 宣告改成 `a0, b0, a1, b1, ..., a7, b7`（而不是 `a[7:0], b[7:0]`），這樣 `bseto -file` 就會自動按交錯順序排列：

**8-bit adder（file order vs. interleaved order）：**

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

原因是加法器的運算是 bit-wise aligned 的：第 i 位的 sum 和 carry 主要依賴同一位的 `a_i`、`b_i` 加上前一位的 carry。交錯順序讓相關的變數在 BDD 決策樹上早期就相鄰出現，BDD 可以最大化 subgraph sharing。而 file order 把所有 `a` 排前面、所有 `b` 排後面，延遲了同一位元的 `a` 和 `b` 的聯合決策，造成大量不可合併的子結構。

我也試了 GV 內建的 `bseto -rfile`（反向檔案順序）：

**8-bit adder（rfile order）：**
節點數：3, 6, 12, 24, 48, 96, 192, 384, 511

比 file order 稍好（511 < 758），但仍然是指數成長，遠不如 interleaved 的 24。

看到 758 → 24 這個 30 倍的差距時我真的嚇到了：同一個電路、同一個 BDD engine，只是變數排列不同就可以差這麼多。這讓我深刻體會到 variable ordering 在 BDD-based verification 中有多關鍵。實務上如果 ordering 選錯了，BDD 可能直接 memory explosion 建不起來；選對了，同一個問題可能幾秒鐘就解完。

### Any creative idea?

一個有趣的方向是做 **自動化的 variable order 搜尋**。可以寫一個腳本來嘗試多種排列（file、rfile、interleaved、random permutation...），對每種排列跑 `bseto -file` + `bcons -all` 並記錄總節點數，最後挑最好的。

另一個想法是結合 **dynamic reordering**：先用任意順序建完 BDD，再套用 sifting 演算法把每個變數上下移動，看哪個位置讓總節點數最小。很多 BDD library（如 CUDD）有內建這個功能。GV 的 lecture note 也有提到 dynamic variable reordering（pp. 7–13）。

### Try different variable for different Boolean functions. Can you conclude with some "good" heuristics for BDD variable ordering?

我把 adder 和 multiplier 在不同順序下的結果整理如下：

**8-bit adder（最大 PO 節點數比較）：**

| 順序 | 最大節點數 | 成長模式 |
|------|----------|---------|
| file order | 758 | 指數 (~2.0x) |
| rfile order | 511 | 指數 (~2.0x) |
| interleaved | 24 | 線性 (~+3) |

**8-bit multiplier（最大 PO 節點數比較）：**

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
