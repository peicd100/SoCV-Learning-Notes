# AGENTS.md

每次閱讀此檔案時請使用 UTF-8（無BOM）。

## 1.基本原則

- 每次對話時(每次你接收到我的指令時)，你必須先「從頭到尾完整讀完」本 AGENTS.md (先在<所在目錄（cwd）>找，再找不到就到使用者資料夾.codex/AGENTS.md 找)。不得依賴先前記憶或上次讀取結果。
- 若你被要求重新閱讀：你必須回到 AGENTS.md 重新讀取。
- 你對話時要先跟我說你找到的AGENTS.md的完整路徑，使用"``"包起來。格式為：「我已閱讀AGENTS.md：'<AGENTS.md的完整路徑>'」 。
- 若找不到AGENTS.md就要跟我說，然後停止接下來的動作。
- 請全程使用繁體中文
- 中文強制使用 UTF-8（無BOM）
- 對於每個決定，你都要使用網頁搜尋功能，看看有沒有更好的做法，如果有更好的方法你可以直接使用，不需要經過使用者同意，但是要事後跟使用者說。然後要以「穩」的做法為優先，以能夠成功為最大目標。
- 每次你做完我叫你做的事情之後，你要講解你怎麼做到的，使用了什麼。
- 當我沒有叫你幫我動檔案時，你都不要主動幫我。


---

## 2.進階原則

- 你可以對 conda 環境進行任何安裝與修改，東西盡量都安裝在 conda 。如果你有系統安裝與修改的需求，你可以自己操作，但是你最後要跟我說你在哪裡安裝了什麼、系統層面修改了什麼，若無安裝也要告知。
- 你使用 conda 的方式不要用 PowerShell ，因為我沒有把 conda 加入 path，請先使用以下方式，不行的話你再換其他方法
    ```
    call "<CONDA_BASE>\\Scripts\\activate.bat" "<CONDA_BASE>"
    conda activate base
    conda activate PEICD100
    ```
- 當我跟你說我要把這個資料夾當成專案時，或是你看到檔案中有'專案規格書.md'時，你要遵守"## 3.專案規則（非專案時不需遵守）"章節內的規則，否則你完全不用管標題為'3'開頭的所有規則。


## 3.專案規則（非專案時不需遵守）

- 我使用 conda 來管理 python 環境， conda 環境名稱(<ENV_NAME>)請先看REAMDME.md，如果沒有 REAMDME.md 的話請問我。
- 如用 python 寫 GUI / 介面 / 視窗規則，請使用 PySide，主題色使用 #72e3fd。
- 如需要語音，請使用Microsoft Edge / Azure Neural TTS，英文使用加拿大、美國、英國，英文語音預設 en-US-JennyNeural 。
- 如果使用 CLI ，執行時最下面要有單獨一個置底的旋轉特效(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)，後面加上4個空格，不用加上其他文字，整行只要有旋轉特效和4個空格就好。
- 進度條使用"⣿⣿⣿⣿⣿⣿⣷⣦⣀⣀⣀⣀⣀⣀⣀ 37%"這種
- 你執行 python 時應該要盡量使用 conda 來執行
- 我請你幫我打包時，請你先打包成 debug 版測試是否可以執行，再打包成 noconsole 。
- 打包時，.apk的檔名要加上版本號，每次打包都要增加版本號。
- 如果專案有功能可以使用 GPU，請優先使用GPU，若程式偵測不到 GPU 才使用 CPU。
- 你每次對我的專案修改都需要在根目錄維護："README_PEICD100.md" 、 ".gitignore"、"專案規格書.md"，專案規格書是寫專案設定的，要詳細記錄你在做哪個功能時用了什麼方法、架構。
- 也要維護一個"log.md"，記錄下來你每次修改做的所有事情，也就是我和你的對話紀錄的摘要。
- 如果這個專案是一個 python 程式，要維護"vbs_bat/<所在目錄（cwd）_basename>.vbs"和"vbs_bat/run.bat"，讓我按下.vbs之後就可以不顯示.bat視窗執行同層資料夾的專案程式。
- 你維護的這些檔案都要放到. gitignore 
- 你每次閱讀完AGENTS.md之後，要閱讀上述檔案，以理解你和使用者的協作過程、進度。

### 3.1.每次你進行修改，都要依照以下格式對 README_PEICD100.md 維護。

- 第一行必須為：# <所在目錄（cwd）_basename>
- 專案用途
- <所在目錄（cwd）_basename>、<ENV_NAME>(conda 環境名稱)。
- conda環境完整安裝指令(使用'-y'一次複製安裝)
- 程式執行指令
- github 參考指令(完全照貼以下區塊，但是<ENV_NAME>要換成我的)，後期需要你來維護，像是.gitignore需要幫我修改。
    #### 初始化

    ```
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
    git remote add origin https://github.com/peicd100/<ENV_NAME>.git
    git add .
    git commit -m "PEICD100"
    git push -u origin main
    ```

    #### 例行上傳

    ```
    git add .
    git commit -m "PEICD100"
    git push -u origin main
    ```

    #### 還原成Git Hub最新資料

    ```
    git rebase --abort || echo "No rebase in progress" && git fetch origin && git switch main && git reset --hard origin/main && git clean -fd && git status
    ```

    #### 查看儲存庫

    ```
    git remote -v
    ```

    #### 克隆儲存庫

    ```
    git clone https://github.com/peicd100/<ENV_NAME>.git
    ```
- 使用者要求
記錄此專案中，任何值得記下的事情，以利日後你繼續與使用者協作。