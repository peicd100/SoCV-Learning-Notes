import os
import re
from mkdocs.plugins import BasePlugin

class PostBuildAutoSpacePlugin(BasePlugin):
    # 正則表達式匹配中文與英文/數字
    RE_CHINESE_ENGLISH = re.compile(r'([\u4e00-\u9fa5])([a-zA-Z0-9])')
    RE_ENGLISH_CHINESE = re.compile(r'([a-zA-Z0-9])([\u4e00-\u9fa5])')

    def add_spaces(self, text):
        """插入中文與英文/數字之間的空格"""
        text = self.RE_CHINESE_ENGLISH.sub(r'\1 \2', text)
        text = self.RE_ENGLISH_CHINESE.sub(r'\1 \2', text)
        return text

    def on_post_build(self, config):
        """在 MkDocs 完成構建後修改 HTML 文件"""
        site_dir = config['site_dir']

        # 遍歷所有 HTML 文件
        for root, _, files in os.walk(site_dir):
            for file in files:
                if file.endswith('.html'):
                    file_path = os.path.join(root, file)
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()

                    # 修改 HTML 文件
                    updated_content = self.add_spaces(content)

                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(updated_content)
