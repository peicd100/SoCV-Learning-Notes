# PEICD100

## 預覽
```
activate mkdocs
mkdocs serve --dirty 

```
```
activate mkdocs
mkdocs serve 

```
## 每次寫完
```
activate mkdocs
mkdocs gh-deploy
git add .
git commit -m "PEICD100"
git branch -M main
git push -u origin main

```
# 環境安裝指令

## 只安裝環境

```
conda create -n mkdocs python=3.11 -y
activate mkdocs
conda install pip -y 
conda install -n mkdocs -y -c conda-forge ffmpeg pyside6
pip install -r requirements.txt
conda install git -y

```

## 安裝 cuda

```
conda install cuda -c nvidia -y
```

## 使用 git
```
git clone https://github.com/peicd100/university-notes.git
git init
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/peicd100/university-notes.git
git push -u origin main
mkdocs gh-deploy

```


# git 指令

## 初始化
```
git init
git remote add origin https://github.com/peicd100/university-notes.git

```
## 推送到main
```
git add .
git commit -m "PEICD100"
git branch -M main
git push -u origin main

```
## 推送到網頁
```
mkdocs gh-deploy

```
## 還原成 GitHub 最新資料
```
git fetch origin && git switch main && git reset --hard origin/main && git clean -fd && git status

```
## 查看儲存庫
```
git remote -v

```
## 克隆儲存庫
```
git clone https://github.com/peicd100/university-notes.git

```

## 刪除環境+安裝

```
conda activate base
conda env remove -n mkdocs -y


conda create -n mkdocs python=3.11 -y
activate mkdocs
conda install pip -y 
conda install -n mkdocs -y -c conda-forge ffmpeg pyside6
pip install -r requirements.txt
conda install git -y



```


## 虛擬機重新安裝
```
Y:\conda\envs\mkdocs\python.exe -m pip install --force-reinstall --no-cache-dir mkdocs
```