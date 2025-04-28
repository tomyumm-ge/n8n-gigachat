![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

# n8n-nodes-gigachat

**_Этот репозиторий содержит интеграцию Gigachat API в n8n ноды. Я не разработчик Сбер, просто энтузиаст, который сделал ноду для удобства. Для получения любой помощи по Gigachat, обратитесь к [официальной документации](https://developers.sber.ru/dev). Если вы столкнулись с проблемами/багами при использовании ноды - пишите issue, разберёмся._**

## Поддержка AI нод

Модель GigaChat можно добавить в:

- Basic LLM Chain
- Information Extractor
- Question and Answer Chain
- Sentiment Analysis
- Summarization Chain
- Text Classifier

В данный момент не поддерживается:

- AI Agent

## Локальная разработка/запуск

В папке с репозиторием:

```bash
npm install
npm run build
npm link
```

В инстансе n8n

```bash
npm i -g n8n # если ещё не установлен
cd ~/.n8n
mkdir custom && cd custom
npm init -y
npm link n8n-nodes-gigachat
n8n
```

## Лицензия

[MIT](https://github.com/n8n-io/n8n-nodes-starter/blob/master/LICENSE.md)
