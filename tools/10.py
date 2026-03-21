from markdown.extensions import Extension
from markdown.preprocessors import Preprocessor
import re

class PowerExtension(Extension):
    def extendMarkdown(self, md):
        # 使用 PowerPreprocessor 來處理 Markdown 中的 "!^!"
        md.preprocessors.register(PowerPreprocessor(md), 'power_preprocessor', 25)

class PowerPreprocessor(Preprocessor):
    # 定義正則表達式來匹配 "!^!"
    RE = re.compile(r'!\^!')

    def run(self, lines):
        # 這裡的計算邏輯可以使用一個初始值，比如 n=2
        initial_value = 2
        initial_result = initial_value ** 10  # Python 計算 n^10

        # 定義插入的 HTML 和 JavaScript 代碼，將計算結果嵌入到 HTML 中
        power_html = f'''
        <div>
            <label for="numberInput">輸入一個數字: </label>
            <input type="number" id="numberInput" placeholder="輸入數字" value="{initial_value}">
            <button onclick="calculatePower()">計算 n^10</button>
            <p id="result">初始計算結果 (Python 計算): {initial_result}</p>
        </div>
        <script>
            function calculatePower() {{
                var input = document.getElementById('numberInput').value;
                var result = Math.pow(input, 10);
                document.getElementById('result').innerText = '結果: ' + result;
            }}
        </script>
        '''

        # 將每一行中的 "!^!" 替換為這段 HTML
        new_lines = []
        for line in lines:
            new_line = self.RE.sub(power_html, line)
            new_lines.append(new_line)

        return new_lines

# 創建一個函數來載入這個擴展
def makeExtension(**kwargs):
    return PowerExtension(**kwargs)
