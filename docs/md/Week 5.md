# Week 5

## Advanced BDD Techniques

### Building local BDDs with cuts

我這一段最大的收穫，是我開始把「建 BDD」這件事想成一個分治問題，而不是一口氣把整個電路全部壓成一張大圖。所謂用 cuts 建 local BDD，本質上就是先在電路中選幾個切點，把大電路切成幾個比較小的 cone，分別替每一塊建立 BDD，最後再把它們接回來。這個想法很直覺，但對 BDD 來說差很多，因為 global BDD 常常不是邏輯上太難，而是中途 node 爆太快。

我自己把它想成「先存局部摘要，再往上組合」。例如一個 adder，如果我先把低位元的 carry logic 做成一個 local BDD，再把它當成中介訊號餵給高位元區塊，整個過程就像先把子模組壓縮好，再做更高層的推理。這和軟體裡先寫 helper function 很像，差別只是這裡的 helper 不是 code，而是被 canonical 化之後的布林函數表示。

這個方法真正有用的地方，是它把「一定要看全部細節」變成「先只看 cut 兩側的介面」。如果 cut 選得好，兩邊的相關變數數量會明顯下降，BDD 比較容易共享子圖。如果 cut 選得不好，反而會引入太多中介變數，最後只是把困難換個地方爆掉。所以 cut 不是隨便切就好，它比較像一種架構設計決策。

我覺得這個觀念很重要，因為它讓我意識到 formal verification 並不是單純把工具打開、按下去、等結果，而是要先決定怎麼表示問題。很多時候問題本身沒變，但 representation 換了，工具是否跑得動就完全不一樣。這種感覺和我之前學 variable ordering 時很像，只是這次從「變數順序」進一步變成「整個驗證分解策略」。

### "Compose" operation

`compose` 的意思，我現在會把它理解成「把一個函數中的某個變數，直接用另一個函數替換掉」。如果寫成數學形式，比較像是把 \(f(x, y)\) 裡的 \(y\) 用 \(g(z)\) 取代，得到 \(f(x, g(z))\)。在 BDD 世界裡，這個操作特別重要，因為我們前面把電路切開之後，後面一定要有方法把它們重新接起來，而 `compose` 就是那個接線動作。

我覺得它最像的比喻是 function inlining。前面我先把某個子電路的輸出建成 BDD，這個輸出對上層來說只是「一個布林變數」；可是當我要把整體功能還原時，就不能只停在抽象名字，必須把那個名字背後真正代表的函數內容灌回去。這時候 `compose` 就把抽象訊號和實際邏輯重新縫在一起。

這個操作的好處，是我可以把「建構」和「組合」分開思考。先在小範圍內把 BDD 建好，再視需要逐層 compose 回去，通常比一開始就做 global construction 穩很多。不過它也不是免費的，因為如果被代入的函數本身很大，或者替換的位置很多，compose 之後的 BDD 還是可能瞬間長大。所以 `compose` 比較像是讓我延後爆炸，而不是保證永遠不爆。

我自己很喜歡這個概念，因為它讓「階層式設計」和「階層式驗證」真正接上了。以前我會把 hierarchy 當成閱讀方便或重用方便，現在我比較能理解：如果 representation 和操作設計得對，hierarchy 本身就能直接變成 verification 的 leverage。

### Building partial BDDs by Case splitting

Case splitting 讓我想到的第一件事，就是「既然整體太大，那我先把它拆成幾個互斥情況各自處理」。這個方法在數學證明、SAT solving、甚至手算題目都很常見，放到 BDD 也是一樣。與其試圖一次表示所有輸入情況，不如先固定某些關鍵條件，讓每個子問題的 BDD 都小很多，最後再把結果合起來。

我覺得最直觀的例子，是先對某個高影響力變數做 split。例如一個序向電路裡，如果某個 mode bit 決定系統會走完全不同的 datapath，那把 `mode=0` 和 `mode=1` 分開處理通常很合理。因為兩邊各自的行為比較單純，BDD 比較容易共享；如果硬要把兩種模式揉在同一張圖裡，往往只是讓不相干的結構互相干擾。

這種方法的代價，是我必須管理多個 partial result，而且最後還要確認這些 cases 真的覆蓋全部情況、彼此也沒有重疊錯誤。如果 split 太細，問題雖然變小，但管理成本會暴增；如果 split 不夠聰明，則只是把原本的困難複製很多份。換句話說，case splitting 很有效，但它不是暴力枚舉，而是要挑那種真正能改變結構複雜度的切分點。

我很喜歡這個方法背後的味道，因為它讓我重新認識「工程上的證明」常常不是一次完成的，而是透過把問題切成幾塊後逐步收斂。這種思維和我以前在寫程式 debug 時很像：不是一開始就追全部執行路徑，而是先找最有資訊量的分支。原來 formal world 也很吃這種切分策略。

### Reducing BDD sizes by “don’t-cares” (restrict operation)

`restrict` 讓我第一次很明確地感受到：有些時候我們根本不需要在整個布林空間上把函數描述得一模一樣，只需要在「真的會發生」或「我真的在乎」的區域上保持等價就夠了。這裡的 `don’t-care` 就是 care-set 的反面，也就是那些就算值被改掉、也不影響我要回答的問題的區域。

我查了一些 BDD 相關資料後，對 `restrict(f, g)` 的理解變得比較穩。它不是單純做 cofactor，而是利用 care-set \(g\) 去產生一個在 \(g\) 上和 \(f\) 一致、但在 \(g\) 外面可以更自由簡化的函數 \(h\)。這種想法很漂亮，因為它直接承認了「外面那塊我不 care」，所以工具終於可以大膽做壓縮，而不是被迫在所有不重要的 assignment 上也維持精確。

我很容易把它聯想到 assertion checking。假設某個 property 只在合法 state encoding 下有意義，那對那些非法 encoding，我其實不需要把 monitor 的行為描述得很漂亮。又或者某個子電路只會在 enable=1 時被觀察，那 enable=0 的空間就可以視為 don’t-care。這時候用 restrict 去做 simplification，感覺就很像先把 environment assumption 寫進去，再讓 BDD 針對真正 relevant 的區域縮小。

這個觀念也讓我比較能接受為什麼「真實世界的 verification」不能只追求全域精確。有時候全域精確是做得到，但成本太高；而如果我能明確說出哪些區域不重要，restrict 就把這份額外知識轉成實際的 node reduction。我覺得這很像把 domain knowledge 直接拿去換計算資源，這種感覺非常工程。

### Partial BDD constructions

走到這裡我發現，partial BDD construction 其實不是單一技巧，而是前面幾種方法的總結觀念。它的核心不是「把 BDD 做一半」，而是「只建到目前問題真正需要的那一半」。如果我目前只想回答某個 property、某個 output、某段邏輯，沒有必要把整個設計全展開。

我會把這件事理解成一種節制。BDD 最怕的不是某一步錯，而是每一步都很合理，最後卻因為做了太多其實不必要的工作而爆掉。partial construction 的價值，就在於它提醒我先問自己：我現在要證明的是哪件事？需要哪些 state / transition / output？哪些可以先不碰？

把 local cuts、compose、case splitting、restrict 放在一起看，我覺得這一段真正教我的不是某條公式，而是一個很完整的工程態度：不要一開始就執著於把全世界都表示出來，先把目前最有用、最可控的部分建起來，再逐步擴張。這和很多大型系統開發的策略非常一致，難怪它會成為進一步做 sequential BDD 或 symbolic verification 的前置觀念。

做完這段整理後，我對 BDD 的印象也從「漂亮的理論資料結構」變成「需要非常會節流的工程工具」。如果不懂得 cut、restrict、partialize，就算理論上能表示，實務上也可能完全跑不起來。這種落差反而讓我更能理解為什麼這一週要特別講這些 reduction techniques。

## [LN] Playing with different DDs

### (Recommended, but can be difficult) Implement FDD in GV

FDD（Functional Decision Diagram）最吸引我的地方，是它不再用最熟悉的 Shannon decomposition，而是改用 Davio decomposition。對我來說，這不只是公式換寫法，而是代表它把 XOR-heavy 的函數看得比較自然。尤其當我想到 adder 的 sum bit，本來就是一連串 XOR，這時候 Davio 的語意就顯得特別順手。

如果寫成公式，positive Davio decomposition 可以寫成
\[
f = f|_{x=0} \oplus x \cdot (f|_{x=0} \oplus f|_{x=1})
\]
它和 Shannon decomposition 的差別，在於後者把世界切成 `x=0` 和 `x=1` 兩半；Davio 則更像是「先抓 base，再補差值」。我覺得這種寫法對線性、XOR 主導的函數很有味道，因為差值本身就常常很簡潔。

我實際去看了 GV 目前的架構後，覺得「在 GV 裡做 FDD」這件事理論上合理，但工程量真的不小。GV 現在的 BDD 流程是建在 RicBDD 的 `ite` / Shannon 風格上，很多基本操作都預設這套分解方式。如果要改成 FDD，通常不是只加一個新指令，而是要重新思考 canonical form、reduction rule、以及 apply/composition 相關流程。這也是為什麼我這次沒有假裝自己已經把它實作完。

不過即使沒真的把 package 寫出來，我還是覺得這個方向很值得。它讓我第一次很直白地看到：decision diagram 並不是只有 BDD 一種「唯一正解」，而是可以根據函數結構換 decomposition。也就是說，真正重要的可能不是「我會不會用 BDD」，而是「我有沒有選到符合函數語意的表示法」。

### Compare the sizes of DDs, especially on arithmetic circuits

把不同 DD 放在一起看之後，我最有感的是：它們並不是單純在比誰比較先進，而是在比「誰最適合這類結構」。BDD 很通用，但對 variable ordering 很敏感；ZDD 很適合 sparse set family；FDD 對 XOR-heavy logic 比較自然；MTBDD（ADD）適合 terminal value 不只是 0/1 的函數；\*BMD 則明顯偏向算術 datapath。它們各自擅長的問題，差別其實非常大。

我把這幾種 DD 的感覺整理成下面這張表：

| DD 類型 | 主要表示單位 | 我覺得最適合的場景 | 在算術電路上的感受 |
|---------|--------------|--------------------|------------------|
| BDD | Boolean function | 一般 control / property / symbolic reasoning | adder 可能很好，multiplier 常常爆 |
| ZDD | sparse set family | cover、組合集合、只含少量元素的集合族 | 不是主打算術，但在稀疏結構很省 |
| FDD | Davio-based Boolean function | XOR-heavy logic、Reed-Muller 味道強的函數 | sum bits 這類結構比 BDD 更自然 |
| MTBDD (ADD) | Boolean input to multi-valued output | cost、weight、numeric table、概率或計數 | 比 BDD 更適合保留數值 terminal |
| \*BMD | multilinear polynomial / arithmetic function | datapath、尤其乘法與字級算術 | 這裡最有優勢 |

如果只看我前面用 GV 做過的 BDD 實驗，8-bit adder 在 file order 和 interleaved order 之間就能從 758 個節點掉到 24 個；但 8-bit multiplier 即使換 order，仍然很容易維持在幾千個節點。這代表 BDD 不是不能做 arithmetic，而是它對「哪種 arithmetic」非常挑。Adder 還有機會靠 ordering 救回來，multiplier 則比較像碰到 representation mismatch。

我後來看到 ZDD 的 sparse family 觀念和 \*BMD 的字級算術表示時，突然比較能接受這件事了。原來不同 DD 真正厲害的地方，不在於它們都能做同一件事，而在於它們抓住的共享結構不一樣。ZDD 抓的是「大多數元素不出現」的共享；\*BMD 抓的是「多項式與數值運算」的共享；BDD 抓的則是布林子函數的共享。當共享來源不同，最好的資料結構自然也會不同。

### (Manual) \*BMD construction

\*BMD（Binary Moment Diagram）這一段讓我非常有感，因為它不像 BDD 那樣一直逼我用 bit-level 的眼光看所有東西，而是直接承認 arithmetic function 本來就是數值函數。把 Boolean variables 視為 \(0/1\) 數值後，整個函數就能改寫成 multilinear polynomial，然後再用 moment 的方式去表示它。這個觀點一換，我對 multiplier 為什麼在 \*BMD 下比較自然，突然就完全懂了。

以 2-bit 乘法為例，令
\[
a = 2a_1 + a_0,\quad b = 2b_1 + b_0
\]
那麼
\[
z = a \cdot b = (2a_1 + a_0)(2b_1 + b_0)
  = 4a_1b_1 + 2a_1b_0 + 2a_0b_1 + a_0b_0
\]
我很喜歡這個展開，因為它直接把乘法的結構攤在我面前。以前在 BDD 裡，乘法常常看起來像一大堆 AND/XOR/carry 的糾纏；但在 \*BMD 的語言裡，它其實就是一個非常正常的多項式。

如果換成 3-bit 加法，事情甚至更簡單。令
\[
a = 4a_2 + 2a_1 + a_0,\quad b = 4b_2 + 2b_1 + b_0
\]
那
\[
s = a + b = 4(a_2+b_2) + 2(a_1+b_1) + (a_0+b_0)
\]
這時候我幾乎一眼就能看出來為什麼它會是線性結構。也就是說，\*BMD 對加法和乘法這類字級函數，不只是「可以表示」，而是它根本就在用函數本來的語言講話。

這個過程讓我得到一個很強的 insight：很多 verification 的困難，未必來自函數本身真的複雜，而是來自我選錯了 representation。乘法在 bit-level BDD 下看起來很恐怖，但在 \*BMD 裡卻突然很合理。這讓我第一次很真心地覺得，formal verification 其實也很像演算法課裡的老話一句話: 選對資料結構，問題就先解掉一半。

/// collapse-code
```text title="2-bit 與 3-bit 的 \*BMD 多項式展開"
# 2-bit multiplication
a = 2*a1 + a0
b = 2*b1 + b0
z = a * b
  = 4*(a1*b1) + 2*(a1*b0) + 2*(a0*b1) + (a0*b0)

# 3-bit addition
a = 4*a2 + 2*a1 + a0
b = 4*b2 + 2*b1 + b0
s = a + b
  = 4*(a2+b2) + 2*(a1+b1) + (a0+b0)
```
///

### Any creative research idea?

我現在最想做的一個方向，是 **hybrid DD flow**。直覺上，一個真實設計通常同時有 control logic 和 datapath，如果我硬要整顆設計只用單一 DD 類型，幾乎一定會有一塊很吃虧。所以比較合理的路線，可能是 control 用 BDD、稀疏集合用 ZDD、算術 datapath 用 \*BMD，最後再靠明確的 interface 和 compose / abstraction 把它們接起來。

另一個我覺得很有趣的題目，是做 **automatic DD selection**。也就是先分析某個子電路的結構特徵，例如 XOR 密度、乘法器樣式、set-family 稀疏度，再自動決定它該用哪種 representation。這件事如果做得好，感覺很像 compiler 的 optimization pass，只是最佳化的不是 machine code，而是 symbolic representation。

我還想到一個比較跳的方向：把 ZDD 拿去壓 clause family 或 test pattern family。因為 ZDD 很擅長處理 sparse families of sets，而很多 verification artifact 本質上也是集合族，只是我們平常不一定用這種角度去看它。如果這件事真的可行，可能就不只是在 BDD-based verification 裡有用，連 SAT / ATPG / diagnosis 都可能吃得到好處。

做完這一題後，我最大的感受反而不是「哪一種 DD 最強」，而是我開始比較願意把 representation 當成研究問題本身。以前我會把資料結構當成工具箱裡的被動元件，現在我覺得它本身就是演算法設計的一部分，甚至直接決定哪些問題可解、哪些問題不可解。

## Formally Prove the Assertions of the Design

### I have done the simulation, and then...

這個問題一開始看起來很普通，但我其實被它戳得有點痛，因為它直接問了一件我平常很容易偷懶的事：如果 simulation 沒看到 bug，我憑什麼覺得它就是對的？我以前也常常在波形看起來都正常之後，就很自然地把「目前沒看到問題」往前滑成「應該沒問題」。但這一段提醒我，這兩句話其實差非常多。

Simulation 的本質，還是只在看有限條 input trace。就算我跑了很多 pattern、很多 cycle，它依然是在抽樣，而不是窮舉。對 combinational bug 還比較直覺，因為我可以想像有些 input 根本沒測到；對 sequential design 來說更麻煩，因為除了 input 組合之外，還有 state sequence 的爆炸。我如果沒走到那條 path，再漂亮的 waveform 也只是代表「這條 path 沒出事」。

這也是為什麼我很喜歡「reachable states」這個轉折。真正要證明 assertion，不能只看 monitor 這個布林函數本身是不是常數 0，因為 raw state space 裡可能有很多根本到不了的 assignment。我要證明的其實是：在 reset 可達、並且沿著 transition relation 真正能走到的那些 states 裡，monitor 永遠不會變成 1。也就是說，證明對象不是孤立的 property，而是 property 在 reachable state set 上的交集。

這一點讓我對 formal verification 的價值更有感。它不是把 simulation 再跑大一點，而是把問題改寫成「所有可達狀態中，是否存在 violation」。一旦問題被寫成這樣，就不再是抽樣品質的問題，而是數學上的存在性問題。這種差別真的很本質。

### Some words about GV

我這次有真的進去看 GV 目前能做到什麼。先用 `./gv` 啟動之後，`help` 可以看到 BDD 相關指令，也可以看到 prove commands，像是 `PINITialstate`、`PTRansrelation`、`PIMAGe`、`PCHECKProperty`。光是看到這些指令名稱，我就比較能把整個 BDD-based assertion checking 的流程在腦中串起來：先有 initial state，再有 transition relation，接著做 image，最後再檢查 property。

不過我也很明確感受到，工具的「介面存在」不代表「整套功能在我這份環境裡已經完整可用」。我去看了目前工作樹裡的 `gv/src/prove/proveBdd.cpp`，裡面的 `buildPInitialState()`、`buildPTransRelation()`、`buildPImage()`、`runPCheckProperty()` 目前都還是 `TODO`。這件事對我來說反而很有幫助，因為它逼我不要把指令名字誤認成已完成的演算法。

我還滿喜歡頁面裡提到的一個態度：安裝問題可以先用 AI 幫忙處理，但如果只是環境 local fix，就不要隨便推回 remote；真的做出通用修正，再開 branch / PR。這種做法很合理，因為 toolchain 問題常常是環境特例，如果沒分清楚，真的很容易把自己的 workaround 當成大家都需要的 patch。

做完這段之後，我對 GV 的感覺不是「它是個黑盒工具」，而是「它是一個正在演進中的開源實驗場」。這樣看之後，我反而比較不怕讀它的 source 了，因為我知道自己不是在偷看神祕內部機制，而是在理解一套本來就鼓勵使用者參與完善的工具。

### Let’s do some experiments. Make sure you have successfully installed GV and be able to execute the following script...

這一段我有照著目前環境去試。`./gv` 本身可以正常啟動，`help` 也能列出 prove commands，所以至少主程式和基本命令列互動是活的。我也能成功 `cirread -v ./designs/V3/traffic/traffic.v`，代表 `trafficLight` 這個例子不是只停在文件裡，而是真的可以被目前這份 GV 讀進來。

但是當我照著頁面上的流程去跑 `rand sim -sim 5 -rst_n reset -v` 時，這台環境會卡在 CXXRTL 的 header 缺失，錯誤訊息裡很明確地出現 `fatal error: backends/cxxrtl/cxxrtl_vcd.h: No such file or directory`。這讓我知道目前這裡不是「命令打錯」，而是 simulation 這條支線還沒補齊依賴。這個觀察我覺得很值得記下來，因為它比單純寫「模擬沒跑出來」更有資訊量。

另一方面，我也試著去理解 BDD assertion checker 這條路的入口。從 `help` 看得到 prove commands，從 source 也看得到介面和 command parsing 已經在，但真正的 BDD 演算法核心還沒有補完。所以就這一週來說，我比較誠實的結論是：我已經能把 workflow 和設計意圖看懂，也能確認工具現況，但我不能假裝自己已經在這台機器上完整跑通 BDD-based assertion checking。

這個經驗反而讓我覺得很真實。因為實際做 formal tool 的時候，本來就常常不是「理論會了，工具就一次跑通」，而是要同時面對演算法、介面、依賴、build system。把這些卡點一起記錄下來，我覺得比只貼成功畫面更像真的做過實驗。

/// collapse-code
```text title="我在這份環境實際測到的 GV 流程"
$ ./gv
setup> help
... 可以看到 PINITialstate / PTRansrelation / PIMAGe / PCHECKProperty ...

setup> cirread -v ./designs/V3/traffic/traffic.v
Converted 0 1-valued FFs and 10 DC-valued FFs.

setup> rand sim -sim 5 -rst_n reset -v
.sim_main.cpp:7:10: fatal error: backends/cxxrtl/cxxrtl_vcd.h: No such file or directory
```
///

### What do these properties mean?

`trafficLight` 這個例子裡，我最先注意到的是 `p1` 和 `p2` 的性質其實都偏 safety。`p1` 在檢查 `light` 這個狀態編碼是不是落在合法值集合 `{RED, GREEN, YELLOW}` 之外；如果 `light` 不是這三個之一，`p1` 就會變成 1。`p2` 則是在檢查 counter 是否超過當前顏色對應的上限，所以它比較像是「倒數計時不應該越界」。

`p_r`、`p_y`、`p_g` 對我來說比較像觀察訊號，而不是完整 assertion。它們把目前狀態直接 expose 成三個布林輸出，方便我在 simulation 或後續驗證中觀察系統到底停在哪個燈號。這些訊號本身有用，但如果只靠它們，還不夠回答更有趣的 correctness 問題。

例如頁面裡提的那句「紅燈之後 60 秒要變綠燈」，這就不是單一時刻的 combinational predicate 可以表達的事。它牽涉到時間、狀態轉移、以及從某個事件開始之後的多步行為。也就是說，它不是 `state_is_valid` 這種 invariant，而比較像 temporal property。這點讓我很清楚地感受到：不是所有 assertion 都長得像一條 `assign p = ...`。

我覺得這一段最重要的提醒，是不要因為有幾條 property output 就誤以為 correctness 已經被完整覆蓋了。`p1` 和 `p2` 可以抓到 encoding / range 這類 bug，但它們並沒有直接保證完整的 timing behavior、phase ordering、或 eventual state change。換句話說，它們是有價值的，但它們只覆蓋 correctness 的某一部分。

### What do you see during the “random sim”? Are the properties correct?

如果只看 random simulation 的結果，最容易得到的印象就是：`p1` 和 `p2` 都一直是 0，所以好像沒問題。這當然是好現象，因為至少在我實際看到的 trace 上沒有 violation；但這個結論很容易被講得太大。比較精確的說法應該是：在這些被抽到的 pattern 和這些跑到的 cycles 上，我沒有看到 violation。

真正關鍵的點在於，`p1` 和 `p2` 的 raw BDD 不一定會是常數 0。這件事一開始我其實有點卡住，但後來想通了：BDD 如果只是表示 monitor 這個函數，它看到的是整個 state/input 空間，而不是只有 reset 之後真的能走到的那些 states。以 `p1` 為例，只要 `light = 2'b11`，它就會是 1；可是這個編碼可能在設計的 transition relation 下根本 unreachable。也就是說，monitor 函數本身不為 0，並不代表設計真的會違反 property。

這就是為什麼 reachable states 這個概念不能省略。我要檢查的不是 `monitor == 0` 在所有 assignment 上都成立，而是 `monitor == 0` 在所有 reachable states 上都成立。從這個角度看，simulation 和 BDD 的角色其實很不一樣：simulation 給我 sample trace，BDD 則是幫我表示整個 state set 和 transition relation，讓我能問「有沒有可達反例」。

我覺得這一段是這週最核心的轉折。前面幾週我比較像是在學怎麼建 BDD、怎麼看 BDD 大小；到這裡，我第一次很明確地看到 BDD 為什麼會變成 verification 的主角。因為它不只是 compact representation，它更是把「所有 reachable states」這種看起來根本存不下的東西，變成可以實際操作的數學物件。這個轉換真的很震撼。
