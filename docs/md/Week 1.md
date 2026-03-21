# Week 1
## [LN] Common Knowledges about IC Designs
### Why do we need hardware description languages (HDLs) (e.g., SystemVerilog) to design and implement hardware?
因為現代 IC 的複雜度高到不可能用畫電路圖或手刻 gate-level 來可靠地做完，而且我們需要同一份「可精準定義行為」的描述，同時服務多個目的：模擬、驗證、綜合、甚至形式方法分析。
### How do the mindset and coding guidelines differ between hardware design and software development?
軟體預設是序列，硬體預設是並行。在 C++ 寫一個 for 迴圈通常是「重複執行」；在硬體綜合視角下，常見情況是「展開成硬體結構」。所以 coding guideline 會強調：避免無界迴圈、避免動態資料結構、避免不受控的複雜控制流。
### Why is it called register-transfer level (RTL), and why do we emphasize synthesizable code?
RTL 是在同步數位電路設計裡最主流的抽象層次：用「暫存器之間的資料流動」加上「暫存器之間的組合運算」來描述電路。
synthesizable code：指的是 HDL 的一個「可被綜合成實體硬體」的子集合。
有些 HDL 語法只適合模擬，不可能變成硬體，例如某些 delay、純 testbench 用的行為、檔案 I/O、隨機化、某些不可界定硬體資源的動態行為等。
強調 synthesizable 的原因是：我們要確保「模擬語意」與「硬體實作」一致否則會出現 sim OK、synth 之後行為不同的災難。
## [LN] HW vs. SW Designs
### Given the extremely low tolerance for bugs in hardware design, why is hardware development still feasible and practical?
硬體開發不是靠一開始就零 bug，而是靠抽象化、模組化、IP 重用、模擬、形式驗證、簽核流程，以及晶片回來後的除錯 / ECO 流程，系統化地降低風險。
### Is it because hardware implementation is fundamentally simpler than software development?
不是。硬體驗證常常更難，因為它必須面對並行、時序與狀態空間爆炸。硬體之所以可行，不是因為它簡單，而是因為很多硬體系統有足夠清楚的結構，可以被系統化建模與驗證。
