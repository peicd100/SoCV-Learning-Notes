# Week 1
## [LN] Common Knowledges about IC Designs
### Why do we need hardware description languages (HDLs) (e.g., SystemVerilog) to design and implement hardware?

最直接的原因是**規模**。1970 年代的 IC 只有幾千個 gate，用手畫 schematic 還勉強可行；但今天一顆 SoC 動輒上百億個電晶體（例如 Apple M2 Ultra 有 1340 億），用人手去畫每一條線根本不可能。HDL 讓我們可以在「行為」或「暫存器傳輸」的抽象層次描述電路，再交給 EDA 工具自動綜合成 gate-level netlist，大幅提升生產力。

另一個很重要的好處是**一魚多吃**：同一份 SystemVerilog code 可以同時拿來做 simulation（驗證功能是否正確）、synthesis（產生實際硬體）、formal verification（用數學方法窮舉證明性質），甚至可以搭配 UVM 做 constrained random verification。如果沒有 HDL，這些流程各自用不同的表示法，彼此之間的一致性就很難保證。

我覺得 HDL 之於硬體設計，就像高階程式語言之於軟體開發。它是一次關鍵的 abstraction leap。在 HDL 出現之前，設計者直接跟 gate 和 wire 搏鬥；HDL 出現之後，設計者可以用「意圖」來描述電路，讓工具去處理細節。這個轉變跟軟體從組語跳到 C 語言的過程非常類似。

延伸來想，HDL 也帶來了一個副作用：它讓硬體設計的門檻降低了，但也讓工程師更容易寫出「可以 simulate 但無法 synthesize」的 code。這就是為什麼後面會強調 synthesizable coding style，因為 HDL 太自由了，自由到可以寫出「只存在於模擬世界」的東西。

### How do the mindset and coding guidelines differ between hardware design and software development?

最根本的差異是：**軟體是序列的，硬體是並行的**。寫 C++ 的時候，statement 一行一行往下執行；但在 Verilog 裡，所有的 `always` block 是同時在跑的，每一個都像一個獨立的小電路在平行運作。

我自己在剛開始學 Verilog 的時候最大的衝擊就是 `=`（blocking）和 `<=`（non-blocking）的差別。在軟體裡 `a = b; b = a;` 的結果是 `a` 和 `b` 都變成 `b` 的舊值；但在硬體裡用 `<=` 的話，兩行是「同時」發生的，所以會變成 swap。這個觀念轉換花了我一些時間才適應。

幾個重要的 coding guideline 差異：

| 面向 | 軟體 (C/C++) | 硬體 (Verilog/SV) |
|------|-------------|------------------|
| 執行模型 | 序列 | 並行 |
| 迴圈 | 可以用任意次數 | 必須在 compile time 確定展開次數 |
| 記憶體 | 動態 malloc/new | 面積固定，編譯時決定 |
| 時序 | 基本不考慮 | clock、setup/hold 是命脈 |
| debug | printf + debugger | waveform + assertion |

我的 insight 是：寫 RTL 的時候不能用「寫程式」的思維，要用「畫電路」的思維。每寫一行 code 都要在腦中想像「這會對應到什麼硬體結構」：一個 `if-else` 就是一個 mux，一個 `always @(posedge clk)` 就是一組 flip-flop。如果腦中沒有這個映射，就很容易寫出不可綜合或者面積爆炸的 code。

延伸思考：這也解釋了為什麼 HLS（High-Level Synthesis）雖然讓人可以用 C/C++ 寫硬體，但效果常常不如手寫 RTL，因為 C 語言本身的抽象就是序列的，compiler 要猜測哪些東西可以平行化、pipeline 該怎麼切，很多決定是 heuristic 而不是最優。

### Why is it called register-transfer level (RTL), and why do we emphasize synthesizable code?

RTL 的名字來自它的核心抽象：**暫存器 (register)** 之間的**資料傳輸 (transfer)**。在同步數位電路裡，所有資料都存在 flip-flop（暫存器）裡，每個 clock cycle 資料從一組暫存器經過組合邏輯運算後，存入下一組暫存器。RTL 就是描述「這些暫存器之間發生了什麼運算和傳輸」的層次。

硬體設計有多個抽象層次，從上到下大致是：

- **System/Behavioral level**：用演算法描述功能，不管硬體結構
- **RTL**：用暫存器和組合邏輯描述，可綜合
- **Gate level**：用 AND/OR/NOT/FF 等 gate 描述
- **Transistor level**：用 NMOS/PMOS 描述

RTL 之所以是主流，是因為它在「抽象程度」和「硬體可控性」之間達到了最佳平衡，比 gate level 好寫得多，但又足夠具體到可以直接綜合成 gate。

至於為什麼強調 synthesizable code：HDL（如 SystemVerilog）的語法其實非常豐富，裡面有很多東西只能用在 simulation，不可能變成真正的硬體。例如：

```v
#10 a = 1;         // delay：硬體不能「等 10ns」
$display("hello"); // 印東西：硬體沒有 stdout
initial begin ... end // 只在 simulation 開始時跑一次
```

如果不小心在 design code（而不是 testbench）裡混入了這些語法，就會出現一個災難性的後果：**simulation 跑起來一切正常，但 synthesize 之後的硬體行為完全不同**。這就是所謂的 sim-synth mismatch，是 IC 設計中最恐怖的 bug 之一。

我的 insight 是：synthesizable 的限制乍看之下很不方便（不能用 delay、不能用動態記憶體、迴圈必須有固定邊界），但它其實是一件好事。這些限制迫使設計者寫出**可預測**的硬體：每個 construct 都有明確的硬體對應，EDA 工具可以確定性地把它轉換成 gate，而不需要靠猜測。這跟軟體裡「限制反而提升可靠性」的哲學（如 Rust 的 ownership model）有異曲同工之處。

### Given the extremely low tolerance for bugs in hardware design, why is hardware development still feasible and practical?

硬體開發可行，不是因為設計者不會犯錯，而是因為有一套**系統化的品質保障機制**在管理風險。

首先是**抽象化與模組化**。現代 SoC 大約 70% 以上的面積是由驗證過的 IP block 組成（CPU core、GPU、memory controller、PHY 等），設計者不需要從零開始。這些 IP 已經經過供應商和客戶多年的驗證和量產，可靠度很高。新設計的部分通常只佔整體的一小部分。

其次是**多層次驗證流程**。從 RTL simulation、formal verification、gate-level simulation、STA（Static Timing Analysis）、DRC/LVS（physical verification），到最後的 ATE testing，每一層都有專門的工具和方法論在把關。以 Intel Pentium FDIV bug 為例：那個 bug 最終造成了約 4.75 億美元的損失，但它也促使整個產業投入更多資源在形式驗證上。現在的形式驗證工具已經可以對算術單元做窮舉證明，類似的 bug 在現代流程中被捕捉到的機率高很多。

第三是 **ECO（Engineering Change Order）** 作為最後防線。即使 tape-out 之後才發現 bug，有些 bug 可以透過只改 metal layer 來修復（metal ECO），不需要重做整個晶片。

我的 insight 是：硬體開發的可行性本質上是一個**風險管理**的問題，而不是「做到零 bug」的問題。沒有人能保證 100% 沒有 bug（課堂上也提到了這個哲學問題），但透過 IP reuse + 多層驗證 + ECO 機制，可以把 bug 逃逸的機率壓到可接受的商業風險範圍內。

延伸想法：這跟航空工業的安全思維很像：飛機不是「不會壞」，而是有層層的 redundancy 和 fail-safe 機制讓「壞了也不會墜機」。硬體也是一樣。

### Is it because hardware implementation is fundamentally simpler than software development?

完全不是。硬體驗證在很多方面其實比軟體測試**更難**。

第一個原因是**狀態空間爆炸**。一個只有 32 個 flip-flop 的電路就有 2^32 ≈ 43 億個可能的狀態。一個典型的 SoC 有數百萬個 flip-flop，狀態空間是 2 的數百萬次方，甚至比宇宙中的原子數還多。要窮舉驗證所有狀態是不可能的。

第二個原因是**並行與時序**。軟體 bug 通常跟程式邏輯有關，但硬體 bug 還可能來自 clock domain crossing、setup/hold violation、metastability 等時序問題。這些 bug 可能只在特定的 timing condition 下才會出現，simulation 很難捕捉。

第三個原因是**驗證複雜度的雙重指數成長**。課堂上提到：隨著設計複雜度因 Moore's Law 呈指數成長，驗證複雜度以 "doubly exponential" 的速度成長。這意味著設計規模每翻一倍，驗證的工作量可能增加不止一倍。業界有個說法：「verification effort is 60-70% of the total chip development effort」，也就是大部分的人力和時間其實都花在驗證上。

那硬體之所以仍然可行，不是因為它簡單，而是因為硬體系統通常具有**高度的結構規律性**。不像一般軟體（尤其是涉及 user input、網路、多執行緒的軟體）那樣充滿不確定性，硬體電路是由有限的 gate 和 flip-flop 組成的有限狀態機。這種結構化的特性讓**形式方法**（BDD、SAT、model checking）有施力點：如果系統是有限狀態的，我們就有可能用數學方法窮舉證明它的正確性。這正是這門課接下來要學的核心內容。

我的 insight 是：這門課的存在本身就說明了硬體驗證有多難：如果硬體比軟體簡單，就不需要一門專門的課程來教「怎麼證明硬體是對的」。但也正因為硬體有結構可循，所以形式驗證才能在硬體領域取得比軟體領域更大的成功。這讓我對接下來要學的 BDD 和 SAT 充滿期待。

## [LN] HW vs. SW Designs

（此 LN 的兩個子題已併入上方 [LN] Common Knowledges 的 Q4 和 Q5，因為它們在 lecture note 中是連續出現的。為了清晰，這裡重新列出 h3 標題以對應原始結構。）

### Given the extremely low tolerance for bugs in hardware design, why is hardware development still feasible and practical?

（見上方 [LN] Common Knowledges Q4 的完整回答。）

硬體開發可行的核心原因不是「設計者不會犯錯」，而是有一套系統化的品質保障機制：IP reuse 降低了需要從零驗證的比例；多層次驗證流程（simulation → formal → STA → physical verification → ATE）在每個階段攔截不同類型的 bug；ECO 作為 tape-out 後的最後修復手段。整個體系的目標不是「零 bug」，而是把 bug 逃逸的機率壓到商業上可接受的程度。

### Is it because hardware implementation is fundamentally simpler than software development?

（見上方 [LN] Common Knowledges Q5 的完整回答。）

絕對不是。硬體驗證比軟體測試更難的原因包括：狀態空間呈指數爆炸（2^n 個 flip-flop 的狀態）、timing-related bug 在 simulation 中不易暴露、驗證複雜度以 doubly exponential 成長。硬體之所以仍然可行，是因為它的有限狀態結構讓形式方法有了數學上的切入點，而這正是 SoCV 這門課的核心。
