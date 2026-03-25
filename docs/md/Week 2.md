# Week 2
## [LN] How to verify the correctness of your (RTL) design?
### How do you know your implementation is correct?

我採用 simulation-based verification 來驗證我的販賣機 RTL。整個過程分成三步：先根據 spec 寫出 RTL design，再寫 testbench 去驅動它，最後觀察 simulation 結果是否符合規格。

**設計決策過程**

拿到 spec 之後，我先把販賣機的行為拆解成一個 3-state FSM：`SERVICE_ON`（等待 request）→ `SERVICE_BUSY`（計算交易）→ `SERVICE_OFF`（展示結果）→ 回到 `SERVICE_ON`。我選擇把所有找零邏輯放在 `SERVICE_BUSY` 的組合邏輯裡一次算完，而不是像 GV 附的範例 `vending-simple.v` 那樣在 `SERVICE_BUSY` 裡用多個 cycle 逐幣找零。一次算完的好處是不需要追蹤中間狀態，邏輯比較簡單、不容易出錯。

找零策略我選了 greedy：依序優先使用較大面額硬幣（50 → 10 → 5 → 1）。每個面額用一個 bounded for-loop 嘗試扣款，如果扣到零錢用完或餘額不夠就換下一個面額。如果最後 remainder 不是 0（表示找不開），就全額退幣、不出貨。

另外一個重要的設計決策是**庫存上限的飽和加法**。每種硬幣的庫存用 3-bit 存（最大 7），投入硬幣時要把客戶的硬幣加進去，但不能超過 7。我用了一個 `sat_add3` function 做飽和加法，避免 overflow。

**遇到的困難**

最棘手的部分是找零邏輯的 corner case。例如：客戶投了足夠的錢，但機器裡的零錢組合剛好找不開（比如要找 8 塊但只有 50 和 10 的硬幣）。我一開始沒考慮到這種情況，testbench 跑下去才發現 bug。修正方式是在找零循環結束後檢查 `remainder`，不為零就退幣。

另一個踩坑的地方是 `always @(*)` 裡的 latch inference。我一開始忘了在某個分支寫 `serviceTypeOut = state;`，Vivado 警告了 inferred latch。後來我把 `serviceTypeOut` 改成用獨立的 combinational always block 直接接 state，就解決了。

**Testbench 策略**

我寫了 18 個 directed test cases，涵蓋：reset 初始化、精確付款、金額不足退幣、找不開退幣、正確找零、BUSY/OFF 期間插入 request 應被忽略、庫存飽和上限等。最後統計 PASS/FAIL 和 PASS RATE，全部 18/18 通過。

**Insight**

做完之後我深刻體會到 directed test 的局限性：我寫了 18 個 test case 覺得「應該夠了」，但其實不可能覆蓋所有輸入組合。一個完整的測試應該要考慮的空間是：4 種硬幣 x 每種 0-3 枚 x 3 種商品 x 各種庫存狀態，排列組合的數量遠超過手動能寫的。這讓我理解為什麼需要 constrained random verification（Week 1 講到的 CRV）和 formal verification（後面幾週會學的 BDD/SAT）。手動寫 directed test 只是一個起點，不是終點。

另外，我後來拿同樣的 spec 去讓 Cursor 生成 Verilog code，發現 AI 生出來的版本跟我自己寫的架構差異蠻大的，它用了 `integer` 型別做中間計算，coding style 也比較偏 behavioral。這讓我想到：AI 生成的 code 看起來能跑，但你不知道它的 quality 好不好、有沒有隱藏的 bug，所以「驗證」這件事變得更重要了。


/// collapse-code  
```v title="vending_machine.v"
`timescale 1ns / 1ps

module vending_machine (
    input              clk,
    input              reset,
    input      [1:0]   coinInNTD_50,
    input      [1:0]   coinInNTD_10,
    input      [1:0]   coinInNTD_5,
    input      [1:0]   coinInNTD_1,
    input      [1:0]   itemTypeIn,
    output reg [2:0]   coinOutNTD_50,
    output reg [2:0]   coinOutNTD_10,
    output reg [2:0]   coinOutNTD_5,
    output reg [2:0]   coinOutNTD_1,
    output reg [1:0]   itemTypeOut,
    output reg [1:0]   serviceTypeOut
);

    localparam [1:0] ITEM_NONE = 2'b00;
    localparam [1:0] ITEM_A    = 2'b01; // 8
    localparam [1:0] ITEM_B    = 2'b10; // 15
    localparam [1:0] ITEM_C    = 2'b11; // 22

    localparam [1:0] SERVICE_ON   = 2'b00;
    localparam [1:0] SERVICE_BUSY = 2'b01;
    localparam [1:0] SERVICE_OFF  = 2'b10;

    reg [1:0] state;

    // internal inventory
    reg [2:0] inv50, inv10, inv5, inv1;

    // latched request
    reg [1:0] req_item;
    reg [1:0] req_in50, req_in10, req_in5, req_in1;

    // temp variables for BUSY computation
    integer input_total_i;
    integer price_i;
    integer rem_i;
    integer avail50_i, avail10_i, avail5_i, avail1_i;
    integer used50_i, used10_i, used5_i, used1_i;
    integer k;

    function [2:0] sat_add3;
        input [2:0] a;
        input [1:0] b;
        reg   [3:0] tmp;
        begin
            tmp = a + b;
            if (tmp > 4'd7)
                sat_add3 = 3'd7;
            else
                sat_add3 = tmp[2:0];
        end
    endfunction

    function integer item_price;
        input [1:0] item;
        begin
            case (item)
                ITEM_A:   item_price = 8;
                ITEM_B:   item_price = 15;
                ITEM_C:   item_price = 22;
                default:  item_price = 0;
            endcase
        end
    endfunction

    // state reflected to output directly
    always @(*) begin
        serviceTypeOut = state;
    end

    always @(posedge clk or posedge reset) begin
        if (reset) begin
            state <= SERVICE_ON;

            inv50 <= 3'd2;
            inv10 <= 3'd2;
            inv5  <= 3'd2;
            inv1  <= 3'd2;

            req_item <= ITEM_NONE;
            req_in50 <= 2'd0;
            req_in10 <= 2'd0;
            req_in5  <= 2'd0;
            req_in1  <= 2'd0;

            coinOutNTD_50 <= 3'd0;
            coinOutNTD_10 <= 3'd0;
            coinOutNTD_5  <= 3'd0;
            coinOutNTD_1  <= 3'd0;
            itemTypeOut   <= ITEM_NONE;
        end
        else begin
            case (state)
                // ------------------------------------------------
                // ON: wait for a valid request
                // ------------------------------------------------
                SERVICE_ON: begin
                    // clear visible outputs while idle
                    coinOutNTD_50 <= 3'd0;
                    coinOutNTD_10 <= 3'd0;
                    coinOutNTD_5  <= 3'd0;
                    coinOutNTD_1  <= 3'd0;
                    itemTypeOut   <= ITEM_NONE;

                    if (itemTypeIn != ITEM_NONE) begin
                        req_item <= itemTypeIn;
                        req_in50 <= coinInNTD_50;
                        req_in10 <= coinInNTD_10;
                        req_in5  <= coinInNTD_5;
                        req_in1  <= coinInNTD_1;
                        state    <= SERVICE_BUSY;
                    end
                    else begin
                        state <= SERVICE_ON;
                    end
                end

                // ------------------------------------------------
                // BUSY: calculate transaction result
                // ------------------------------------------------
                SERVICE_BUSY: begin
                    input_total_i =
                          (req_in50 * 50)
                        + (req_in10 * 10)
                        + (req_in5  * 5)
                        + (req_in1  * 1);

                    price_i = item_price(req_item);

                    // default outputs
                    coinOutNTD_50 <= 3'd0;
                    coinOutNTD_10 <= 3'd0;
                    coinOutNTD_5  <= 3'd0;
                    coinOutNTD_1  <= 3'd0;
                    itemTypeOut   <= ITEM_NONE;

                    // money not enough -> full refund
                    if (input_total_i < price_i) begin
                        coinOutNTD_50 <= {1'b0, req_in50};
                        coinOutNTD_10 <= {1'b0, req_in10};
                        coinOutNTD_5  <= {1'b0, req_in5};
                        coinOutNTD_1  <= {1'b0, req_in1};
                        itemTypeOut   <= ITEM_NONE;
                        // inventory unchanged
                    end
                    else begin
                        // machine takes input coins first, saturating at 7
                        avail50_i = sat_add3(inv50, req_in50);
                        avail10_i = sat_add3(inv10, req_in10);
                        avail5_i  = sat_add3(inv5,  req_in5);
                        avail1_i  = sat_add3(inv1,  req_in1);

                        rem_i = input_total_i - price_i;

                        used50_i = 0;
                        for (k = 0; k < 7; k = k + 1) begin
                            if ((rem_i >= 50) && (used50_i < avail50_i)) begin
                                used50_i = used50_i + 1;
                                rem_i    = rem_i - 50;
                            end
                        end

                        used10_i = 0;
                        for (k = 0; k < 7; k = k + 1) begin
                            if ((rem_i >= 10) && (used10_i < avail10_i)) begin
                                used10_i = used10_i + 1;
                                rem_i    = rem_i - 10;
                            end
                        end

                        used5_i = 0;
                        for (k = 0; k < 7; k = k + 1) begin
                            if ((rem_i >= 5) && (used5_i < avail5_i)) begin
                                used5_i = used5_i + 1;
                                rem_i   = rem_i - 5;
                            end
                        end

                        used1_i = 0;
                        for (k = 0; k < 7; k = k + 1) begin
                            if ((rem_i >= 1) && (used1_i < avail1_i)) begin
                                used1_i = used1_i + 1;
                                rem_i   = rem_i - 1;
                            end
                        end

                        if (rem_i == 0) begin
                            // success
                            coinOutNTD_50 <= used50_i[2:0];
                            coinOutNTD_10 <= used10_i[2:0];
                            coinOutNTD_5  <= used5_i[2:0];
                            coinOutNTD_1  <= used1_i[2:0];
                            itemTypeOut   <= req_item;

                            inv50 <= avail50_i[2:0] - used50_i[2:0];
                            inv10 <= avail10_i[2:0] - used10_i[2:0];
                            inv5  <= avail5_i[2:0]  - used5_i[2:0];
                            inv1  <= avail1_i[2:0]  - used1_i[2:0];
                        end
                        else begin
                            // cannot make exact change -> full refund
                            coinOutNTD_50 <= {1'b0, req_in50};
                            coinOutNTD_10 <= {1'b0, req_in10};
                            coinOutNTD_5  <= {1'b0, req_in5};
                            coinOutNTD_1  <= {1'b0, req_in1};
                            itemTypeOut   <= ITEM_NONE;
                            // inventory unchanged
                        end
                    end

                    state <= SERVICE_OFF;
                end

                // ------------------------------------------------
                // OFF: show result for one cycle, then go back to ON
                // ------------------------------------------------
                SERVICE_OFF: begin
                    req_item <= ITEM_NONE;
                    req_in50 <= 2'd0;
                    req_in10 <= 2'd0;
                    req_in5  <= 2'd0;
                    req_in1  <= 2'd0;
                    state    <= SERVICE_ON;
                end

                default: begin
                    state <= SERVICE_ON;
                end
            endcase
        end
    end

endmodule
```
///


/// collapse-code  
```v title="tb_vending_machine.v"
`timescale 1ns / 1ps

module tb_vending_machine;

    reg         clk;
    reg         reset;
    reg  [1:0]  coinInNTD_50;
    reg  [1:0]  coinInNTD_10;
    reg  [1:0]  coinInNTD_5;
    reg  [1:0]  coinInNTD_1;
    reg  [1:0]  itemTypeIn;

    wire [2:0]  coinOutNTD_50;
    wire [2:0]  coinOutNTD_10;
    wire [2:0]  coinOutNTD_5;
    wire [2:0]  coinOutNTD_1;
    wire [1:0]  itemTypeOut;
    wire [1:0]  serviceTypeOut;

    localparam [1:0] ITEM_NONE = 2'b00;
    localparam [1:0] ITEM_A    = 2'b01;
    localparam [1:0] ITEM_B    = 2'b10;
    localparam [1:0] ITEM_C    = 2'b11;

    localparam [1:0] SERVICE_ON   = 2'b00;
    localparam [1:0] SERVICE_BUSY = 2'b01;
    localparam [1:0] SERVICE_OFF  = 2'b10;

    integer pass_count;
    integer fail_count;
    real    pass_rate;

    vending_machine dut (
        .clk(clk),
        .reset(reset),
        .coinInNTD_50(coinInNTD_50),
        .coinInNTD_10(coinInNTD_10),
        .coinInNTD_5(coinInNTD_5),
        .coinInNTD_1(coinInNTD_1),
        .itemTypeIn(itemTypeIn),
        .coinOutNTD_50(coinOutNTD_50),
        .coinOutNTD_10(coinOutNTD_10),
        .coinOutNTD_5(coinOutNTD_5),
        .coinOutNTD_1(coinOutNTD_1),
        .itemTypeOut(itemTypeOut),
        .serviceTypeOut(serviceTypeOut)
    );

    initial begin
        clk = 1'b0;
        forever #5 clk = ~clk;
    end

    task clear_inputs;
        begin
            coinInNTD_50 = 2'd0;
            coinInNTD_10 = 2'd0;
            coinInNTD_5  = 2'd0;
            coinInNTD_1  = 2'd0;
            itemTypeIn   = ITEM_NONE;
        end
    endtask

    task do_reset;
        begin
            clear_inputs();
            reset = 1'b1;
            repeat (2) @(posedge clk);
            reset = 1'b0;
            @(posedge clk);
            #1;
        end
    endtask

    task apply_request;
        input [1:0] in50;
        input [1:0] in10;
        input [1:0] in5;
        input [1:0] in1;
        input [1:0] item;
        begin
            @(negedge clk);
            coinInNTD_50 = in50;
            coinInNTD_10 = in10;
            coinInNTD_5  = in5;
            coinInNTD_1  = in1;
            itemTypeIn   = item;

            @(negedge clk);
            clear_inputs();
        end
    endtask

    // 在 BUSY / OFF 時故意插入一筆 request，撐到下一個 posedge
    task poke_request_until_posedge;
        input [1:0] in50;
        input [1:0] in10;
        input [1:0] in5;
        input [1:0] in1;
        input [1:0] item;
        begin
            @(negedge clk);
            coinInNTD_50 = in50;
            coinInNTD_10 = in10;
            coinInNTD_5  = in5;
            coinInNTD_1  = in1;
            itemTypeIn   = item;
            @(posedge clk);
            #1;
            clear_inputs();
        end
    endtask

    task expect_state_on;
        input [8*80-1:0] case_name;
        begin
            $display("------------------------------------------------------------");
            $display("CASE: %0s", case_name);
            $display("ACTUAL: serviceTypeOut=%0d", serviceTypeOut);
            $display("EXPECT: serviceTypeOut=%0d (SERVICE_ON)", SERVICE_ON);

            if (serviceTypeOut === SERVICE_ON) begin
                pass_count = pass_count + 1;
                $display("[PASS] %0s", case_name);
            end
            else begin
                fail_count = fail_count + 1;
                $display("[FAIL] %0s", case_name);
            end
        end
    endtask

    task expect_inventory;
        input [8*80-1:0] case_name;
        input [2:0] exp50;
        input [2:0] exp10;
        input [2:0] exp5;
        input [2:0] exp1;
        begin
            $display("CASE: %0s", case_name);
            $display("ACTUAL INV : (50:%0d, 10:%0d, 5:%0d, 1:%0d)",
                     dut.inv50, dut.inv10, dut.inv5, dut.inv1);
            $display("EXPECT INV : (50:%0d, 10:%0d, 5:%0d, 1:%0d)",
                     exp50, exp10, exp5, exp1);

            if ((dut.inv50 === exp50) &&
                (dut.inv10 === exp10) &&
                (dut.inv5  === exp5 ) &&
                (dut.inv1  === exp1 )) begin
                pass_count = pass_count + 1;
                $display("[PASS] %0s", case_name);
            end
            else begin
                fail_count = fail_count + 1;
                $display("[FAIL] %0s", case_name);
            end
        end
    endtask

    task wait_for_state_with_timeout;
        input [1:0] target_state;
        input integer max_cycles;
        input [8*80-1:0] wait_name;
        integer c;
        begin
            c = 0;
            while ((serviceTypeOut !== target_state) && (c < max_cycles)) begin
                @(posedge clk);
                c = c + 1;
            end
            if (serviceTypeOut !== target_state) begin
                $display("------------------------------------------------------------");
                $display("[TIMEOUT] %0s", wait_name);
                $display("Expected state=%0d, but current serviceTypeOut=%0d after %0d cycles",
                         target_state, serviceTypeOut, max_cycles);
                fail_count = fail_count + 1;
            end
        end
    endtask

    task expect_off_result;
        input [8*80-1:0] case_name;
        input [1:0] exp_item;
        input [2:0] exp50;
        input [2:0] exp10;
        input [2:0] exp5;
        input [2:0] exp1;
        begin
            wait_for_state_with_timeout(SERVICE_OFF, 20, case_name);
            if (serviceTypeOut === SERVICE_OFF) begin
                #1;
                $display("------------------------------------------------------------");
                $display("CASE: %0s", case_name);
                $display("ACTUAL: item=%0d, change=(50:%0d, 10:%0d, 5:%0d, 1:%0d)",
                         itemTypeOut,
                         coinOutNTD_50, coinOutNTD_10, coinOutNTD_5, coinOutNTD_1);
                $display("EXPECT: item=%0d, change=(50:%0d, 10:%0d, 5:%0d, 1:%0d)",
                         exp_item, exp50, exp10, exp5, exp1);

                if ((itemTypeOut   === exp_item) &&
                    (coinOutNTD_50 === exp50)    &&
                    (coinOutNTD_10 === exp10)    &&
                    (coinOutNTD_5  === exp5 )    &&
                    (coinOutNTD_1  === exp1 )) begin
                    pass_count = pass_count + 1;
                    $display("[PASS] %0s", case_name);
                end
                else begin
                    fail_count = fail_count + 1;
                    $display("[FAIL] %0s", case_name);
                end

                @(posedge clk);
            end
        end
    endtask

    task expect_stay_on_for_n_cycles;
        input [8*80-1:0] case_name;
        input integer ncycles;
        integer i;
        reg ok;
        begin
            ok = 1'b1;
            for (i = 0; i < ncycles; i = i + 1) begin
                @(posedge clk);
                if (serviceTypeOut !== SERVICE_ON)
                    ok = 1'b0;
            end

            $display("------------------------------------------------------------");
            $display("CASE: %0s", case_name);
            if (ok) begin
                pass_count = pass_count + 1;
                $display("[PASS] %0s", case_name);
            end
            else begin
                fail_count = fail_count + 1;
                $display("[FAIL] %0s", case_name);
            end
        end
    endtask

    // 檢查接下來幾個 cycle 內不會再進入 BUSY
    task expect_no_busy_for_n_cycles;
        input [8*80-1:0] case_name;
        input integer ncycles;
        integer i;
        reg ok;
        begin
            ok = 1'b1;
            for (i = 0; i < ncycles; i = i + 1) begin
                @(posedge clk);
                if (serviceTypeOut === SERVICE_BUSY)
                    ok = 1'b0;
            end

            $display("------------------------------------------------------------");
            $display("CASE: %0s", case_name);
            if (ok) begin
                pass_count = pass_count + 1;
                $display("[PASS] %0s", case_name);
            end
            else begin
                fail_count = fail_count + 1;
                $display("[FAIL] %0s", case_name);
            end
        end
    endtask

    initial begin
        pass_count = 0;
        fail_count = 0;
        clear_inputs();
        reset = 1'b0;

        $display("============================================================");
        $display("START VIVADO SIMULATION");
        $display("============================================================");

        do_reset();
        expect_state_on("Reset should put machine into SERVICE_ON");

        expect_inventory("Reset should initialize inventory to 2 each",
                         3'd2, 3'd2, 3'd2, 3'd2);

        do_reset();
        apply_request(2'd0, 2'd0, 2'd0, 2'd0, ITEM_NONE);
        expect_stay_on_for_n_cycles("ITEM_NONE should keep machine idle", 3);

        do_reset();
        apply_request(2'd0, 2'd0, 2'd1, 2'd3, ITEM_A);
        expect_off_result("ITEM_A exact pay 8 -> vend, no change",
                          ITEM_A, 3'd0, 3'd0, 3'd0, 3'd0);
        expect_inventory("After ITEM_A exact pay, inventory should update",
                         3'd2, 3'd2, 3'd3, 3'd5);

        do_reset();
        apply_request(2'd0, 2'd1, 2'd0, 2'd0, ITEM_B);
        expect_off_result("ITEM_B pay 10 -> not enough, refund 10",
                          ITEM_NONE, 3'd0, 3'd1, 3'd0, 3'd0);
        expect_inventory("Refund case should not change inventory",
                         3'd2, 3'd2, 3'd2, 3'd2);

        do_reset();
        apply_request(2'd0, 2'd3, 2'd0, 2'd0, ITEM_C);
        expect_off_result("ITEM_C pay 30 -> cannot make exact change, refund",
                          ITEM_NONE, 3'd0, 3'd3, 3'd0, 3'd0);

        do_reset();
        apply_request(2'd0, 2'd2, 2'd0, 2'd3, ITEM_C);
        expect_off_result("ITEM_C pay 23 -> vend and change 1x1",
                          ITEM_C, 3'd0, 3'd0, 3'd0, 3'd1);

        do_reset();
        apply_request(2'd0, 2'd2, 2'd0, 2'd0, ITEM_B);
        expect_off_result("ITEM_B pay 20 -> vend and change 1x5",
                          ITEM_B, 3'd0, 3'd0, 3'd1, 3'd0);

        // BUSY injection case
        do_reset();
        apply_request(2'd0, 2'd0, 2'd1, 2'd3, ITEM_A);
        wait_for_state_with_timeout(SERVICE_BUSY, 20, "Wait BUSY for BUSY injection case");
        if (serviceTypeOut == SERVICE_BUSY) begin
            poke_request_until_posedge(2'd0, 2'd2, 2'd0, 2'd0, ITEM_B);
            $display("------------------------------------------------------------");
            $display("CASE: Request during BUSY should be ignored");
            $display("ACTUAL current OFF result: item=%0d, change=(50:%0d,10:%0d,5:%0d,1:%0d)",
                     itemTypeOut, coinOutNTD_50, coinOutNTD_10, coinOutNTD_5, coinOutNTD_1);
            if ((itemTypeOut   === ITEM_A) &&
                (coinOutNTD_50 === 3'd0) &&
                (coinOutNTD_10 === 3'd0) &&
                (coinOutNTD_5  === 3'd0) &&
                (coinOutNTD_1  === 3'd0)) begin
                pass_count = pass_count + 1;
                $display("[PASS] Request during BUSY should be ignored");
            end
            else begin
                fail_count = fail_count + 1;
                $display("[FAIL] Request during BUSY should be ignored");
            end
            @(posedge clk); // leave OFF -> ON
        end
        expect_no_busy_for_n_cycles("No extra transaction should happen after BUSY injection", 3);

        // OFF injection case
        do_reset();
        apply_request(2'd0, 2'd0, 2'd1, 2'd3, ITEM_A);
        wait_for_state_with_timeout(SERVICE_OFF, 20, "Wait OFF for OFF injection case");
        if (serviceTypeOut == SERVICE_OFF) begin
            #1;
            $display("------------------------------------------------------------");
            $display("CASE: Request during OFF should be ignored");
            $display("ACTUAL current OFF result: item=%0d, change=(50:%0d,10:%0d,5:%0d,1:%0d)",
                     itemTypeOut, coinOutNTD_50, coinOutNTD_10, coinOutNTD_5, coinOutNTD_1);
            if ((itemTypeOut   === ITEM_A) &&
                (coinOutNTD_50 === 3'd0)   &&
                (coinOutNTD_10 === 3'd0)   &&
                (coinOutNTD_5  === 3'd0)   &&
                (coinOutNTD_1  === 3'd0)) begin
                pass_count = pass_count + 1;
                $display("[PASS] Request during OFF should be ignored");
            end
            else begin
                fail_count = fail_count + 1;
                $display("[FAIL] Request during OFF should be ignored");
            end

            poke_request_until_posedge(2'd0, 2'd2, 2'd0, 2'd0, ITEM_B);
            @(posedge clk); // 多等一拍，讓 OFF -> ON 的邊界完全過去
        end
        expect_no_busy_for_n_cycles("No extra transaction should happen after OFF injection", 2);

        do_reset();
        dut.inv10 = 3'd6;
        dut.inv1  = 3'd2;
        dut.inv5  = 3'd2;
        dut.inv50 = 3'd2;
        apply_request(2'd0, 2'd2, 2'd0, 2'd2, ITEM_C);
        expect_off_result("Capacity saturation case should still vend ITEM_C with exact pay 22",
                          ITEM_C, 3'd0, 3'd0, 3'd0, 3'd0);
        expect_inventory("inv10 should saturate at 7, not become 8",
                         3'd2, 3'd7, 3'd2, 3'd4);

        do_reset();
        dut.inv50 = 3'd2;
        dut.inv10 = 3'd2;
        dut.inv5  = 3'd0;
        dut.inv1  = 3'd2;
        apply_request(2'd0, 2'd2, 2'd0, 2'd0, ITEM_B);
        expect_off_result("No 5-dollar coin available -> ITEM_B pay20 should refund",
                          ITEM_NONE, 3'd0, 3'd2, 3'd0, 3'd0);

        do_reset();
        apply_request(2'd0, 2'd0, 2'd0, 2'd3, ITEM_A);
        expect_off_result("ITEM_A pay 3 only -> refund all ones",
                          ITEM_NONE, 3'd0, 3'd0, 3'd0, 3'd3);

        $display("============================================================");
        if ((pass_count + fail_count) > 0)
            pass_rate = (pass_count * 100.0) / (pass_count + fail_count);
        else
            pass_rate = 0.0;

        $display("TOTAL CASES = %0d", pass_count + fail_count);
        $display("PASS        = %0d", pass_count);
        $display("FAIL        = %0d", fail_count);
        $display("PASS RATE   = %0.2f%%", pass_rate);

        if (fail_count == 0)
            $display("FINAL RESULT: ALL TESTS PASSED");
        else
            $display("FINAL RESULT: SOME TESTS FAILED");

        $display("============================================================");

        #20;
        $finish;
    end

endmodule
```
///


/// collapse-code  
```txt title="console"
============================================================
START VIVADO SIMULATION
============================================================
------------------------------------------------------------
CASE: Reset should put machine into SERVICE_ON
ACTUAL: serviceTypeOut=0
EXPECT: serviceTypeOut=0 (SERVICE_ON)
[PASS] Reset should put machine into SERVICE_ON
CASE: Reset should initialize inventory to 2 each
ACTUAL INV : (50:2, 10:2, 5:2, 1:2)
EXPECT INV : (50:2, 10:2, 5:2, 1:2)
[PASS] Reset should initialize inventory to 2 each
------------------------------------------------------------
CASE: ITEM_NONE should keep machine idle
[PASS] ITEM_NONE should keep machine idle
------------------------------------------------------------
CASE: ITEM_A exact pay 8 -> vend, no change
ACTUAL: item=1, change=(50:0, 10:0, 5:0, 1:0)
EXPECT: item=1, change=(50:0, 10:0, 5:0, 1:0)
[PASS] ITEM_A exact pay 8 -> vend, no change
CASE: After ITEM_A exact pay, inventory should update
ACTUAL INV : (50:2, 10:2, 5:3, 1:5)
EXPECT INV : (50:2, 10:2, 5:3, 1:5)
[PASS] After ITEM_A exact pay, inventory should update
------------------------------------------------------------
CASE: ITEM_B pay 10 -> not enough, refund 10
ACTUAL: item=0, change=(50:0, 10:1, 5:0, 1:0)
EXPECT: item=0, change=(50:0, 10:1, 5:0, 1:0)
[PASS] ITEM_B pay 10 -> not enough, refund 10
CASE: Refund case should not change inventory
ACTUAL INV : (50:2, 10:2, 5:2, 1:2)
EXPECT INV : (50:2, 10:2, 5:2, 1:2)
[PASS] Refund case should not change inventory
------------------------------------------------------------
CASE: ITEM_C pay 30 -> cannot make exact change, refund
ACTUAL: item=0, change=(50:0, 10:3, 5:0, 1:0)
EXPECT: item=0, change=(50:0, 10:3, 5:0, 1:0)
[PASS] ITEM_C pay 30 -> cannot make exact change, refund
------------------------------------------------------------
CASE: ITEM_C pay 23 -> vend and change 1x1
ACTUAL: item=3, change=(50:0, 10:0, 5:0, 1:1)
EXPECT: item=3, change=(50:0, 10:0, 5:0, 1:1)
[PASS] ITEM_C pay 23 -> vend and change 1x1
------------------------------------------------------------
CASE: ITEM_B pay 20 -> vend and change 1x5
ACTUAL: item=2, change=(50:0, 10:0, 5:1, 1:0)
EXPECT: item=2, change=(50:0, 10:0, 5:1, 1:0)
[PASS] ITEM_B pay 20 -> vend and change 1x5
------------------------------------------------------------
CASE: Request during BUSY should be ignored
ACTUAL current OFF result: item=1, change=(50:0,10:0,5:0,1:0)
[PASS] Request during BUSY should be ignored
------------------------------------------------------------
CASE: No extra transaction should happen after BUSY injection
[PASS] No extra transaction should happen after BUSY injection
------------------------------------------------------------
CASE: Request during OFF should be ignored
ACTUAL current OFF result: item=1, change=(50:0,10:0,5:0,1:0)
[PASS] Request during OFF should be ignored
------------------------------------------------------------
CASE: No extra transaction should happen after OFF injection
[PASS] No extra transaction should happen after OFF injection
------------------------------------------------------------
CASE: Capacity saturation case should still vend ITEM_C with exact pay 22
ACTUAL: item=3, change=(50:0, 10:0, 5:0, 1:0)
EXPECT: item=3, change=(50:0, 10:0, 5:0, 1:0)
[PASS] Capacity saturation case should still vend ITEM_C with exact pay 22
CASE: inv10 should saturate at 7, not become 8
ACTUAL INV : (50:2, 10:7, 5:2, 1:4)
EXPECT INV : (50:2, 10:7, 5:2, 1:4)
[PASS] inv10 should saturate at 7, not become 8
------------------------------------------------------------
CASE: No 5-dollar coin available -> ITEM_B pay20 should refund
ACTUAL: item=0, change=(50:0, 10:2, 5:0, 1:0)
EXPECT: item=0, change=(50:0, 10:2, 5:0, 1:0)
[PASS] No 5-dollar coin available -> ITEM_B pay20 should refund
------------------------------------------------------------
CASE: ITEM_A pay 3 only -> refund all ones
ACTUAL: item=0, change=(50:0, 10:0, 5:0, 1:3)
EXPECT: item=0, change=(50:0, 10:0, 5:0, 1:3)
[PASS] ITEM_A pay 3 only -> refund all ones
============================================================
TOTAL CASES = 18
PASS        = 18
FAIL        = 0
PASS RATE   = 100.00%
FINAL RESULT: ALL TESTS PASSED
============================================================
```
///

