import requests
from bs4 import BeautifulSoup
from markdown.extensions import Extension
from markdown.preprocessors import Preprocessor
import re

class WebScrapeExtension(Extension):
    def extendMarkdown(self, md):
        # 使用 WebScrapePreprocessor 來處理 Markdown 中的 "!scrape!"
        md.preprocessors.register(WebScrapePreprocessor(md), 'web_scrape_preprocessor', 25)

class WebScrapePreprocessor(Preprocessor):
    # 定義正則表達式來匹配 "!scrape!"
    RE = re.compile(r'!school!')

    def run(self, lines):
        # 設定目標 URL
        url = "https://www.reallygood.com.tw/newExam/inside?str=932DEFBF9A06471E3A1436C3808D1BB7"

        # 發送 HTTP 請求並取得網頁內容
        response = requests.get(url)

        if response.status_code == 200:
            # 解析網頁內容
            soup = BeautifulSoup(response.content, "html.parser")

            # 查找所有 <tr> 元素
            trs = soup.find_all("tr")

            # 目標樣式
            target_style = "background: #FF0000; border-radius: 30px; color: #ffffff; display: inline-block; opacity: 1; padding: 1px 5px; text-decoration: none;"

            # 欄位名稱列表
            column_names = ["招生學校", "名額", "報名及繳件日期", "面試日期", "放榜日期", "簡章下載"]

            # 準備結果輸出
            output = []

            # 遍歷每個 <tr>，檢查其中的 <td> 是否包含具有指定樣式的元素
            for tr in trs:
                tds = tr.find_all("td")
                found = False

                # 遍歷每個 <td>，檢查是否有符合樣式的元素
                for td in tds:
                    target_element = td.find(attrs={"style": target_style})
                    if target_element:
                        found = True
                        break

                # 如果找到符合樣式的 <td>，則輸出該 <tr> 中的所有欄位資料
                if found and len(tds) == len(column_names):
                    tr_data = []
                    tr_links = []

                    # 遍歷每個 <td> 並提取資料和連結
                    for td in tds:
                        td_text = td.get_text(strip=True)
                        tr_data.append(td_text)

                        # 查找 <td> 中的所有 <a> 標籤並取得 href
                        links = td.find_all("a", href=True)
                        for link in links:
                            tr_links.append(link['href'])

                    # 將每個欄位與名稱進行配對並生成結果
                    for i, value in enumerate(tr_data):
                        output.append(f"{column_names[i]}: {value}")
                    
                    # 如果有 <a> 標籤，加入連結信息
                    if tr_links:
                        output.append(" | ".join(tr_links))

                    output.append("-----------------------------")

            # 將結果合併為 Markdown 需要的格式
            final_output = "\n".join(output)

        else:
            final_output = f"無法訪問該頁面，HTTP 狀態碼: {response.status_code}"

        # 將每一行中的 "!scrape!" 替換為抓取結果
        new_lines = []
        for line in lines:
            new_line = self.RE.sub(final_output, line)
            new_lines.append(new_line)

        return new_lines

# 創建一個函數來載入這個擴展
def makeExtension(**kwargs):
    return WebScrapeExtension(**kwargs)
