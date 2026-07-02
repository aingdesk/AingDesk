# AingDesk
![GitHub License](https://img.shields.io/github/license/aingdesk/aingdesk)
![GitHub Release](https://img.shields.io/github/v/release/aingdesk/aingdesk)
![GitHub stars](https://img.shields.io/github/stars/aingdesk/aingdesk?style=social)
![GitHub forks](https://img.shields.io/github/forks/aingdesk/aingdesk?style=social)
![GitHub issues](https://img.shields.io/github/issues/aingdesk/aingdesk)
![GitHub last commit](https://img.shields.io/github/last-commit/aingdesk/aingdesk)
![GitHub all releases](https://img.shields.io/github/downloads/aingdesk/aingdesk/total)
![Docker Pulls](https://img.shields.io/docker/pulls/aingdesk/aingdesk)


[简体中文](README.zh_cn.md) | [Official Website](https://www.aingdesk.com/) | [Documentation](https://docs.aingdesk.com/)

AingDesk是一款简单好用的AI助手，支持知识库、模型API、分享、联网搜索、智能体，它还在飞快成长中。

AingDesk is an easy-to-use AI assistant that supports knowledge bases, model APIs, sharing, web search, and intelligent agents. It's rapidly growing and improving.

## 🚀 One-sentence Introduction  

A user-friendly AI assistant software that supports local AI models, APIs, and knowledge base setup.

## ✅ Core Features  

- One-click deployment of local AI models and mainstream model APIs
![Local model](.github/assets/img/1_en.png)
- Local knowledge base
![Knowledge base](.github/assets/img/3_en.png)
- Intelligent agent creation
![Intelligent agent](.github/assets/img/4_en.png)
  
- Can be shared online for others to use
![Sharing](.github/assets/img/5_en.png)

- Supports web search
![Web search](.github/assets/img/6_en.png)

- Supports server-side deployment 

- MCP Client
![MCP Client](.github/assets/img/7_en.png)

- Simultaneous conversations with multiple models in a single session (coming soon)  

## ✨ Product Highlights  
- Simple and easy to use, beginner-friendly for AI newcomers  

## 📥 Quick Installation

### Client Version（MacOS, Windows） 

- [Download from official website](https://www.aingdesk.com/)   
- [Download from CNB](https://cnb.cool/aingdesk/AingDesk/-/releases/)  
- [Download from Github](https://github.com/aingdesk/AingDesk/releases)  

### Server Version

#### Docker Run
```bash 
docker run -d \
  --name node \
  -v $(pwd)/data:/data \
  -v $(pwd)/uploads:/uploads \
  -v $(pwd)/logs:/logs \
  -v $(pwd)/bin:/aingdesk/bin \
  -v $(pwd)/sys_data:/sys_data \
  -p 7071:7071 \
  -w /aingdesk \
  aingdesk/aingdesk
```

#### Docker Compose
```bash
mkdir -p aingdesk
cd aingdesk
wget https://cnb.cool/aingdesk/AingDesk/-/git/raw/server/docker-compose.yml
# Run
docker compose up -d
# or
docker-compose up -d
``` 
## Build
```bash
git clone https://github.com/aingdesk/AingDesk.git
cd AingDesk
# For macOS users, please remove the `@rollup/rollup-win32-x64-msvc` dependency in [package.json](http://_vscodecontentref_/0)
cd frontend
yarn
cd ..
yarn
yarn dev
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `YDC_API_KEY` | You.com API key for web search. | Only if using You.com Search |

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=aingdesk/aingdesk&type=Date)](https://www.star-history.com/#aingdesk/aingdesk&Date)

## Sponsor
- CDN acceleration and security protection for this project are sponsored by Tencent EdgeOne.
[![image](https://github.com/user-attachments/assets/0af60c97-9951-4acf-9cf4-f30ae7f25101)](https://edgeone.ai/?from=github)
