# Публикация расширения в Firefox Add-ons

[English version](publishing.firefox.md)

Инструкция публикации расширения GREEN-API Connector или его white label версии в Firefox Add-ons.

## Требования для публикации в Firefox Add-ons

**Аккаунт** - Mozilla-аккаунт → [Центр разработчиков дополнений](https://addons.mozilla.org/ru/developers/)  
**Взнос** - Не взимается  
**Что загружать** - `release/<name>-<version>-firefox.zip` + архив исходного кода  
**Проверка** - Подпись до 24 часов; ручная проверка может занять дольше

## Шаг 1. Собрать релиз

В магазин загружается только ZIP-файл из корня папки релиза.

1. Соберите релиз в корне репозитория:
   - Воспользуйтесь конструктором из инструкции [«Быстрый старт»](../README.ru.md#быстрый-старт). В поле
     **Firefox ID** укажите уникальный ID дополнения в одном из форматов - `connector@your-company.com` или `@connector`.
   - Или соберите релиз командой: `npm run release -- --lang ru` (ваш бренд из `branding/`)
     или `npm run release -- --lang ru --default-brand` (стандартный GREEN-API Connector)
2. Откройте `release/<name>-<version>/` и возьмите `<name>-<version>-firefox.zip`.
3. Для обновления уже опубликованного расширения сначала поднимите версию: `npm version patch --no-git-tag-version`,
   затем соберите заново. Магазин не примет ту же версию повторно.

Перед загрузкой проверьте:

- Название и иконки — вашего бренда (магазин отклоняет чужое или похожее на чужое оформление).
- В `firefox/manifest.json` в `browser_specific_settings.gecko.id` стоит ваш ID, а не `@green-api-connector`
  (он закреплён за официальной сборкой GREEN-API). Первая загрузка закрепляет ID за дополнением навсегда
  ([об ID дополнения](https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id/)).
- Расширение из `firefox/` проверьте вручную в браузере, [установите расширение локально](./install.browser.ru.md).

Поле `data_collection_permissions` (тип `authenticationInfo`), обязательное для новых дополнений, в манифест уже
добавлено ([сбор данных в Firefox](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)).

## Шаг 2. Подготовить архив исходного кода

Расширение собирается Vite: код объединяется и минифицируется, поэтому Mozilla требует исходники, из которых
проверяющий сможет собрать точно такой же ZIP ([требования к исходному коду](https://extensionworkshop.com/documentation/publish/source-code-submission/)).

1. Закоммитьте все изменения, включая папку `branding/` - без неё соберётся стандартный GREEN-API Connector.
2. Создайте архив из коммита в корне репозитория:

   ```bash
   git archive --format=zip -o release/<name>-<version>-source.zip HEAD
   ```

   В архив попадают только файлы из git: без `node_modules/`, `dist/` и `release/`.

## Шаг 3. Опубликовать в Firefox Add-ons

1. Войдите в [Центр разработчиков дополнений](https://addons.mozilla.org/ru/developers/) под Mozilla-аккаунтом
   компании и нажмите **Отправить новое дополнение**
   ([инструкция Mozilla по отправке дополнения](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)).
2. Выберите, где распространять дополнение:
   - **На этом сайте** - дополнение появится в каталоге addons.mozilla.org;
3. Загрузите `release/<name>-<version>-firefox.zip` и дождитесь автоматической проверки. Ошибки нужно исправить,
   предупреждения публикацию не блокируют. В совместимости оставьте только **Firefox** (без Firefox для Android).
4. На вопрос **«Нужно ли отправлять исходный код?»** ответьте **Да** и в поле **Выгрузить исходный код** выберите
   архив из шага 2.

5. Заполните раздел **Опишите дополнение**
   ([как оформить карточку](https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/)).

   Внимание! Скорректируйте тексты для вашей компании

   **Название** - подставляется из манифеста.

   **Сводка** (до 250 символов)

   ```
   Подключает аккаунт WhatsApp к <Наименование вашего сервиса>: передаёт данные авторизованной сессии WhatsApp Web по запросу пользователя.
   ```

   **Описание**

   ```
   <Ваше наименование приложения> позволяет подключить аккаунт WhatsApp к сервису <Наименование вашего сервиса>.

   По запросу пользователя расширение получает данные текущей авторизованной сессии WhatsApp Web и безопасно передает их в аккаунт <Наименование вашего сервиса>. После успешного переноса локальная сессия WhatsApp Web закрывается.

   Расширение работает только с сайтом WhatsApp Web и выполняет импорт исключительно после явного действия пользователя. Полученные данные используются только для подключения аккаунта к <Наименование вашего сервиса> и обеспечения работы сервиса.
   ```

6. Ниже на той же странице:
   - **Категории** (до 3) - **Общение и коммуникация**;
   - **Адрес эл. почты поддержки** и **url сайта поддержки** - ваши контакты;
   - **Лицензия** - **Лицензия MIT**.


7. Отметьте **Это дополнение имеет политику приватности** и вставьте текст политики: какие данные обрабатываются,
   куда передаются (только в инстанс пользователя), что расширение их не хранит и удаляет данные WhatsApp Web из
   браузера после передачи. Добавьте ссылку на политику конфиденциальности на вашем сайте.

   В **Примечания для проверяющих** вставьте инструкцию по сборке (на английском):

   ```
   The extension is bundled and minified with Vite 5; the source code archive contains the full repository.
   Requirements: Node.js 22 (18+), npm 10; Windows, Linux or macOS.
   Build:
     npm ci
     npm run release -- --lang en
   Result: release/<name>-<version>/firefox/ - identical to the uploaded <name>-<version>-firefox.zip.
   The brand (name, icons, colors, add-on ID) is applied at build time from the branding/ folder.
   "Unsafe assignment to innerHTML" warnings come from the bundled react-dom library.
   ```

8. Нажмите **Представить версию**.

## После отправки

[Подпись и распространение дополнений](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).

Результат проверки приходит на email аккаунта разработчика. Подпись и публикация - до 24 часов; ручная проверка может
идти дольше.

**Если отклонили.** Причина указана в письме и в Центре разработчиков. Чаще всего это исходный код, из которого не
получается такой же ZIP, политика приватности или описание. Исправьте, поднимите версию, соберите заново и отправьте снова.

**Обновление версии:**

1. `npm version patch --no-git-tag-version`, затем `npm run release` и новый архив исходников (шаг 2).
2. Дополнение в Центре разработчиков → **Загрузить новую версию** → новый `-firefox.zip` и архив исходников.

## Источники

- [Submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
- [Source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/)
- [Firefox built-in data collection consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)
- [Extensions and the add-on ID](https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id/)
- [Create an appealing listing](https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/)
- [Signing and distribution overview](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)
