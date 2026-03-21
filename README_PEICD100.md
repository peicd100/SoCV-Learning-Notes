# university notes

## 專案用途
使用 MkDocs Material 維護大學課程筆記與 blog 靜態網站，包含自訂主題、RSS、加密內容、Markdown 延伸功能，以及本機預覽與靜態輸出流程。

## university notes、mkdocs
- 專案資料夾：`y:\github_note\university notes`
- conda 環境名稱：`mkdocs`

## conda環境完整安裝指令
```bat
conda create -n mkdocs python=3.11 pip git ffmpeg -y
conda activate mkdocs
python -m pip install -r requirements.txt pyinstaller
```

## 程式執行指令
```bat
Y:\conda\envs\mkdocs\python.exe -m mkdocs serve --dirty --livereload
Y:\conda\envs\mkdocs\python.exe -m mkdocs build --clean
vbs_bat\university notes.vbs
```

補充：選字後右鍵的「開啟原文檔案」功能只會在 `mkdocs serve` 預覽時啟用；若只是開靜態 `site/` 內容，因為沒有本機查詢 API，所以不會提供這個定位功能。

## 打包指令
先依序測試 debug 版，再打包 noconsole 版：
```bat
Y:\conda\envs\mkdocs\python.exe -m mkdocs build --clean
Y:\conda\envs\mkdocs\python.exe -m PyInstaller --noconfirm --clean --onedir --console --name "university notes" --add-data "site;site" tools\project_launcher.py
Y:\conda\envs\mkdocs\python.exe -m PyInstaller --noconfirm --clean --onefile --windowed --name "university notes" --add-data "site;site" tools\project_launcher.py
```

## github 參考指令
說明：這裡我改用實際儲存庫 `university-notes`，而不是 conda 環境名 `mkdocs`，避免把 remote 指到錯的 GitHub 倉庫。

#### 初始化

```bat
(
echo.
echo # PyInstaller
echo dist/
echo build/
echo user_data/
echo # Python-generated files
echo __pycache__/
echo *.py[oc]
echo build/
echo dist/
echo wheels/
echo *.egg-info
echo # Virtual environments
echo .venv
)>> .gitignore
git init
git branch -M main
git remote add origin https://github.com/peicd100/university-notes.git
git add .
git commit -m "PEICD100"
git push -u origin main
```

#### 例行上傳

```bat
git add .
git commit -m "PEICD100"
git push -u origin main
```

#### 還原成Git Hub最新資料

```bat
git rebase --abort || echo "No rebase in progress" && git fetch origin && git switch main && git reset --hard origin/main && git clean -fd && git status
```

#### 查看儲存庫

```bat
git remote -v
```

#### 克隆儲存庫

```bat
git clone https://github.com/peicd100/university-notes.git
```

## 使用者要求
- 此資料夾已明確視為專案，後續持續維護 `README_PEICD100.md`、`.gitignore`、`專案規格書.md`。
- 任何選取有關的東西，都要用四個角選取敵人的風格，不要用圓角膠囊式高亮。
- 主題色都用 `cyan`。
- 此專案使用 `mkdocs` conda 環境。
- Python 專案需要維護 `vbs_bat\university notes.vbs` 與 `vbs_bat\run.bat`，按 `.vbs` 可直接啟動專案。
- 本機隱藏啟動流程：先 `mkdocs build --clean`，再用 `tools\project_launcher.py` 開啟本機靜態站。
- 2026-03-19：已修正手機窄版側欄圖片/文字遮擋與首頁卡片干擾問題。
- 2026-03-19：已修正手機抽屜標題列 `logo icon` 絕對定位導致的站名字樣遮擋問題。
- 2026-03-19：已將 `docs/md/114-2/電機_作業系統/ch2.md` 的所有 Markdown 標題整體下移一級。
- 2026-03-19：已修正 GitHub Pages 首頁跳錯站的問題，並同步修正 `site_url`、`robots.txt` 與 TTS localStorage 命名空間。
- 2026-03-19：已新增右側 TOC 摺疊功能，支援 active 路徑自動展開與「全部展開 / 全部收合」按鈕。
- 2026-03-19：已將右側 TOC 的「全部展開 / 全部收合」控制列改為固定在導覽頂端，捲動時持續可用。
- 2026-03-19：已將右側 TOC 改為較合理的互動模式，包含 sticky 控制列、自動收合切換、目前章節跟隨，以及右欄手動捲動時暫停同步，並停用衝突的內建 `toc.follow`。
- 2026-03-19：已進一步優化右側 TOC 版型，清掉舊的 active 角框殘留，改成較穩的 grid 排版，避免長標題、展開箭頭與子層內容互相重疊。
- 2026-03-19：已將右側 TOC 欄寬改為可由 CSS 變數調整，並把目前章節跟隨改成節流加最小必要捲動，降低右欄先跳到最上面再回來的抖動。
- 2026-03-19：已將右側 TOC 桌機欄寬改為以獨立變數與主區域最大寬度聯動，讓右欄變寬時不再直接壓縮中間文章；同時將當前章節判定收斂為單一 current 來源，並改為切換章節時置中跟隨，減少雙 active 與跳頂抖動。
- 2026-03-19：已將右側 TOC 自動收合的高度動畫改為較穩定的收合方式，並補上收合後再次置中，降低章節切換後 current 項目漂離中心的情況。
- 2026-03-19：已將右側 TOC 控制列改為 `展開 / 收合 / 自動 / 手動`，其中展開與收合為一次性操作且會切到手動模式；手動模式保留自動跟隨但不再自動改變摺疊狀態。
- 2026-03-19：已在窄版新增右下角 `目錄` 浮動按鈕，按下後使用原本右側 TOC 直接浮出成右側面板，並隱藏左側抽屜中被整合進去的 page TOC。
- 2026-03-19：已將桌機右側 TOC 欄寬改為依視窗寬度動態放大，螢幕不夠寬時退回原本寬度，避免版面貼滿後讓中間文章看起來被擠壓。
- 2026-03-19：已全面優化右側 TOC 滾動體驗：移除 wheel preventDefault 改用 CSS overscroll-behavior 隔離；摺疊動畫從 max-height 改為 grid-template-rows 0fr/1fr 平滑過渡；滾動同步改用 requestAnimationFrame 對齊螢幕刷新；自動收合僅在章節切換時觸發，減少 DOM 抖動。
- 2026-03-19：修正右側 TOC 四項問題：(1) 側邊欄基礎寬度改回 Material 預設 12.1rem，僅在螢幕夠寬時向右延伸至 22rem，內容區不再被壓縮；(2) 控制按鈕改為 flex 均分並加大 padding；(3) 自動摺疊時暫時停用 CSS transition 並保存/還原 scrollTop，解決先跳頂再回來的問題；(4) 滾動定位改為 `behavior: "auto"` 即時到位，不再有延遲。
- 2026-03-19：重寫 toc-fold.js 架構：狀態改用 JS 變數取代 7 個 DOM data 屬性；快取 nestedItems/scrollWrap 減少 DOM 查詢；移除多層間接包裝函式；page scroll listener 防重複綁定；支援 Material instant navigation 正確重初始化。
- 2026-03-19：已將右側 TOC 全面打掉重練為單一共享元件：桌機改成 sticky card 式目錄，窄版改成右下角 `目錄` 按鈕開啟的右側面板；目前章節追蹤改用 `IntersectionObserver + 舒適區跟隨`，`自動` 模式只保留當前閱讀路徑，`手動` 模式則完整保留使用者展開狀態。
- 2026-03-19：已將右側 TOC 的當前章節與網址 hash 統一成同一來源，停用 `navigation.tracking` 改由自訂 scrollspy 用 `history.replaceState()` 同步 fragment；目前章節切換點也改為接近頁首的固定偏移，避免網址停在上一段、右欄卻跳到下一段。
- 2026-03-19：已重新整理右側 TOC 的視覺比例與配色，縮小工具列按鈕、降低亮色模式的玻璃感，並實際檢查桌機/窄版與亮色/暗色四種組合。
- 2026-03-19：已修正右側 TOC 在亮色模式下的「本頁目錄」標題列排版與窄版面板可讀性問題；新版明確覆寫舊的透明背景規則，讓窄版右側面板內層回到實體卡片背景，並補上標題列 `min-width: 0`、單行省略與較穩的文字顏色/透明度設定。
- 2026-03-19：已再修正右側 TOC 兩個細節問題：桌機 `本頁目錄` 標題列改為較寬鬆的行高與內距，避免字形上緣被切到；窄版右側面板則改為標準的 `flex + min-height: 0 + overflow-y: auto` scroll container，並補上 `touch-action: pan-y` 與 `-webkit-overflow-scrolling: touch`，讓目錄內容可穩定上下滑動。
- 2026-03-19：已將右側 TOC 視覺語言收斂到和左側欄一致：整張目錄卡片改成白底 HUD 風格、目前項目與 hover 改用和左欄同系統的四角選取框與發光效果、控制按鈕也改為同樣的角框互動；同時保留各階層前方的對齊導引線，並確認控制列在右欄滾動時會維持 sticky 凍結。
- 2026-03-19：已移除右側 TOC 標題列中的「本頁目錄」文字，並修正亮色模式下目前章節使用 `background` 簡寫導致四角高亮被清掉的問題；右側 current 標題現在和左欄一樣會保留四角效果。
- 2026-03-19：已再收掉桌機右側 TOC 頭部的殘留留白，並在 `tools/project_launcher.py` 的本機預覽伺服器加上 `Cache-Control: no-store`，避免刷新後還吃到舊版 CSS/JS 造成版面看起來沒更新。
- 2026-03-19：已調整右側 TOC 跟隨規則：右欄手動捲動後不再靠計時器自己跳回 current，只有中間文章真的發生捲動/定位更新時才會重新跟隨；同時 `手動` 模式與 `展開 / 收合 / 子章節切換` 也不再自動捲到當前標題，只有 `自動` 模式才會自動收合並跟隨 current。
- 2026-03-19：已將 `docs/md/Verilog/學習資源整理.md` 內原有 Markdown 標題層級整體下移一級（`#` 改 `##`，依此類推）。
- 2026-03-19：已將 `docs/md/Verilog/學習資源整理.md` 內有數字的標題格式由 `1. ## 標題` 統一改為 `## 1. 標題`。
- 2026-03-19：已依照提供圖片調整 `mkdocs.yml` 中 `Verilog` 導覽順序，並將該區導覽路徑統一改為較穩的正斜線寫法。
- 2026-03-19：已在 `mkdocs.yml` 補齊 `科技_計算機結構` 導覽項目，並依照提供圖片固定為 `SI 前綴表 -> ch 1 -> ch 2`。
- 2026-03-19：已將 `docs/md/114-2/資工_電腦輔助 VLSI 設計/nmos、pmos.md` 加入 `mkdocs.yml` 導覽，建立 `資工_電腦輔助 VLSI 設計` 群組。
- 2026-03-19：已將 `docs/md/114-2/資工_電腦輔助 VLSI 設計/教材.md` 加入 `資工_電腦輔助 VLSI 設計` 導覽，並排在 `nmos、pmos` 前面。
- 2026-03-19：已依照提供圖片新增 `電機_作業系統` 導覽順序為 `首頁 -> ch 1 -> windows CLI 指令 -> Linux CLI 指令 -> vim -> 子行程`；圖片中的 `2/19作業`、`20260312_HW2` 目前在專案內找不到對應檔案，暫未加入。
- 2026-03-19：已依照提供圖片新增 `機電_數位邏輯實驗` 導覽順序為 `首頁 -> Quartus 創建專案 -> 跑 tb -> 選腳位 -> 上傳電路板`。
- 2026-03-19：已整理 `docs/md` 的 Markdown 格式：只有原本同檔內含多個 H1 的檔案，才將頁內標題依原有相對層級整體下移一級；並將假表格包 code 與裸露程式碼改成 fenced code block；真正的資料表則保留表格格式。
- 2026-03-19：已新增 HackMD 風格的文章圖片放大檢視功能，支援點擊開啟、滾輪與按鈕縮放、底部百分比顯示、放大後拖曳平移、雙擊切換縮放、背景點擊與 `Esc` 關閉，並相容 Material instant navigation。
- 2026-03-19：已補 Mermaid 初始化覆寫，將 flowchart `htmlLabels` 啟用，讓 ` ```mermaid ` 區塊中的節點文字可使用 `<br>` 正常換行渲染。
- 2026-03-19：已補 Mermaid 首次載入渲染修正，避免頁面初次開啟時只剩 `pre.diagram` 原始碼未轉成 SVG，並支援 Material instant navigation 與主題切換後重繪。
- 2026-03-19：已在 `mkdocs.yml` 補上 `pymdownx.superfences` 的 `mermaid` custom fence，並讓它沿用站內既有的 `diagram` Mermaid loader；現在可直接使用 ` ```mermaid ` fenced code block 渲染 Mermaid 圖表。
- 2026-03-20：已將 Mermaid 圖表做成和圖片相近的置中圖卡樣式，加入邊框、陰影、hover 浮起與可橫向捲動的保護，避免大圖表在窄版被硬擠壞。
- 2026-03-20：已新增 Mermaid 專用放大檢視，支援點擊開啟、滑鼠滾輪縮放、按鈕縮放、拖曳平移、雙擊切換縮放與 `Esc` 關閉，並相容 Material instant navigation。
- 2026-03-20：已補 Mermaid 放大檢視的背景點擊退出；現在點圖外的遮罩區塊也會直接關閉 viewer，操作和站內圖片放大一致。
- 2026-03-20：已修正 Mermaid `htmlLabels` 在部分節點內文被切掉的問題；目前對 Mermaid label 專用 `foreignObject > div` 固定較穩的行高，避免吃到頁面全域 line-height 後超出節點框高。
- 2026-03-20：已在 `自定義.css` 明確覆寫內容區 `h5/h6` 字級，將 `h5` 調為 `1.05rem`、`h6` 調為 `1rem`，避免 `h5` 比內文字還小。
- 2026-03-20：已將內容區 `h1~h6` 改為明確由大到小的字級階梯：`h1=2rem`、`h2=1.7rem`、`h3=1.4rem`、`h4=1.2rem`、`h5=1.05rem`、`h6=1rem`。
- 2026-03-20：已完全移除 `main.html` 對 `star.html` 的引用，並刪除 `docs/theme/star.html`；原本星空背景、流星與滑鼠粒子互動已取消。
- 2026-03-20：為了避免直接拔掉 `star.html` 後連帶丟失舊圖片百分比語法支援，已將那段相容邏輯獨立到 `assets/pymdownx-extras/legacy-image-width.js`，改由 `mkdocs.yml` 的 `extra_javascript` 載入。
- 2026-03-20：已新增 H1 上方的檔案總管式路徑列，樣式類似 `./電機_作業系統/ch 1`；第一段使用目前頂部分頁，第二段使用目前左側欄頁面清單，兩段都可用下拉選單切換。
- 2026-03-20：已將 H1 上方路徑列改為純文字外觀，移除圓形／膠囊背景；目前項目、展開中項目與下拉選單當前項目皆改用左右側欄相同的四角選取高亮。
- 2026-03-20：已將路徑列的未選取文字改回一般淡色，並把目前選取與下拉選單當前項目的文字統一改成主題色 `cyan`。
- 2026-03-20：已再微調路徑列配色，讓上方目前項目文字改成和 `./` 相同的淡色；展開下拉後，未選取項目文字也改深一階，提升亮色模式可讀性。
- 2026-03-20：已將 H1 上方路徑列在手機窄版改為保留顯示的精簡版，使用兩個原生下拉選單切換章節與頁面，避免自訂浮層在手機瀏覽器炸版；並替 `自定義.css`、`folder-path-bar.js` 更新版本參數，降低正式站快取吃到舊檔的機率。
- 2026-03-20：已依 Mermaid 官方較新的設定方式，補上 root-level `htmlLabels`；同時保留原本 flowchart 層設定，兼顧現有版本相容性。
- 2026-03-20：已將 `docs/md/114-2/電機_作業系統/ch 3.md` 內所有 Markdown 標題整體下移一級（`h1 -> h2`、`h2 -> h3`，依此類推）。
- 2026-03-20：已新增本機預覽專用的「選字後右鍵跳到原文位置」功能；在 `mkdocs serve` 下，右鍵選單可依目前頁面與選取內容反查對應 `.md` 檔案與行列，並直接用 VS Code 開啟。
- 2026-03-20：已修正右鍵原文定位的 endpoint 組法，改成跟隨 MkDocs Material 的站台 base path，不再把請求錯誤送到目前頁面的子目錄（如 `md/Verilog/__peicd/...`）。
- 2026-03-20：已把右鍵功能改成由本機後端直接呼叫 VS Code CLI `--reuse-window --goto` 開檔，不再依賴瀏覽器處理 `vscode://` 協定；在 VS Code 內建瀏覽頁面時會更穩。
- 2026-03-19：已將 `docs/md/114-2/科技_計算機結構/ch 2.md` 內所有 fenced code block 標記移除，整頁不再套程式碼框。
- 2026-03-19：已將右側 TOC 四個控制按鈕縮小，並把工具列改成單行排列，避免 `展開 / 收合 / 自動 / 手動` 再排成兩行。
- 2026-03-19：已將深色模式右側 TOC 改成與左欄同系統的深色背景，並把左側抽屜的手機版修正提前套用到 `76.25em` 以下的中寬桌機，避免這種寬度下左欄還保留桌機排版細節。
- 2026-03-21：已將 `docs/md/Verilog/vector.md` 重寫為 Quick Reference，整理成宣告、索引/切片、位寬規則、`{}` 串接與重複、packed/unpacked、常見地雷等速查段落，並補上哪些術語屬於 SystemVerilog 的註記。
- 2026-03-21：已將 `docs/md/Verilog/priority encoder.md` 重寫為 Quick Reference，補上 LSB/MSB 優先方向說明、`casez` 寫法、`valid` 觀念與常見地雷，並修正原本文字描述與範例方向不一致的問題。
- 2026-03-21：已將 `docs/md/Verilog/運算子.md` 重寫為 Quick Reference，重新整理 bitwise/logical/reduction/比較/shift/位寬規則與 signedness，並修正原本對位寬與運算分類較容易誤解的敘述。
