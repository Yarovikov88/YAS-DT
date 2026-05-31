# Requirements Document

## Introduction

YAS-DT v2.4 добавляет ingest-пайплайн наполнения семантического графа знаний фактами, которые
пользователь получает в обычном (бесплатном) Gemini (телефон или браузер, не API). Пользователь
завершает беседу с Gemini заготовленным промтом, Gemini формирует ответ с новыми фактами в виде
текстового контракта с маркерами, пользователь одним тапом экспортирует ответ в Google Docs. На сайте
YAS-DT пользователь нажимает кнопку «Забрать факты»: бэкенд находит новые документы в Google Drive,
парсит их, складывает извлечённые факты в staging-таблицу `inbox_facts`, затем прогоняет их через
Gemini API (проверка, классификация по сфере и тегам, дедупликация, оценка confidence) и наполняет
граф знаний. Факты с высокой уверенностью и без дубликатов вставляются автоматически, остальные ждут
ручного апрува на странице `/inbox`.

Фича закладывает фундамент мультиарендности (`owner_id` во всех новых таблицах) и единый источник
правды для словаря сфер и тегов, но не реализует полноценную мультиарендность с RLS.

### In Scope

- Фундамент `owner_id` в новых таблицах и единый конфиг словаря сфер и тегов.
- Текстовый контракт выгрузки фактов и заготовленный промт для Gemini.
- OAuth 2.0 к Google Drive (scope `drive.readonly`), парсер Google Docs, эндпоинт `POST /api/inbox/fetch`.
- Обработка через Gemini API, порог confidence, простая дедупликация, эндпоинт `POST /api/inbox/process`.
- Очередь `GET /api/inbox`, страница `/inbox`, ручной апрув и отклонение отложенных фактов.
- Идемпотентность, обработка ошибок и безопасность хранения токенов и ключей.

### Out of Scope

- Семантическая дедупликация через pgvector.
- Автоматическое предложение связей между узлами (отложено на v2.5).
- RAG-ассистент с чтением графа и общением.
- Активный сбор фактов (Gemini сам задаёт вопросы).
- Биллинг и тарифы.
- Полноценная мультиарендность с Row-Level Security.

## Glossary

- **YAS_DT**: Веб-приложение цифрового двойника (Next.js 14 App Router + Supabase PostgreSQL), хранящее семантический граф знаний.
- **Граф_Знаний**: Совокупность узлов (факты в таблице `facts`) и типизированных связей (`fact_relations`).
- **Факт**: Узел графа знаний со свойствами `title`, `content`, `category`, `section`, `sphere`, `tags[]`, `weight`, `age`, `status`.
- **Сфера**: Одна из восьми сфер HPI: `loved`, `family`, `friends`, `career`, `physical`, `mental`, `hobby`, `wealth`.
- **Тег**: Метка факта из контролируемых словарей `type`, `context`, `stage`.
- **Конфиг_Словаря**: Единый источник правды, перечисляющий допустимые сферы и теги, заменяющий захардкоженный `SPHERE_LABELS` в `app/graph/page.tsx`.
- **Контракт_Выгрузки**: Текстовый формат с маркерами (`=== YAS-FACTS <дата> ===`, `--- FACT ---`, поля `sphere`, `tags`, `text`), которым Gemini оформляет новые факты.
- **Промт_Выгрузки**: Заготовленный текст, который пользователь вставляет в обычный Gemini, чтобы получить ответ в формате Контракта_Выгрузки.
- **Google_Doc**: Документ Google Docs, созданный кнопкой «Экспортировать в Google Документы» из обычного Gemini, содержащий Контракт_Выгрузки.
- **Drive_Connector**: Серверный компонент YAS_DT, который аутентифицируется в Google Drive по OAuth 2.0 и читает Google_Doc.
- **Парсер_Документа**: Серверный компонент, извлекающий факты из текста Google_Doc по Контракту_Выгрузки.
- **Inbox_Fact**: Запись staging-таблицы `inbox_facts`, представляющая один извлечённый, ещё не подтверждённый факт.
- **Эндпоинт_Fetch**: `POST /api/inbox/fetch` — находит новые Google_Doc, парсит их и создаёт Inbox_Fact со статусом `pending`.
- **Эндпоинт_Process**: `POST /api/inbox/process` — прогоняет Inbox_Fact со статусом `pending` через Gemini_Classifier и принимает решение о вставке.
- **Gemini_Classifier**: Компонент, вызывающий Gemini API (модель `gemini-flash-lite-latest`) для проверки, классификации по сфере и тегам и оценки confidence факта.
- **Confidence**: Числовая оценка уверенности (0..1), возвращаемая Gemini_Classifier для извлечённого факта.
- **Порог_Confidence**: Конфигурируемое пороговое значение Confidence для автоматической вставки факта в граф.
- **Дедупликатор**: Компонент, определяющий дубликаты по нормализованному заголовку или тексту факта (простая дедупликация без pgvector).
- **Inbox_Run**: Запись лог-таблицы `ingest_runs`, фиксирующая один запуск Эндпоинта_Fetch или Эндпоинта_Process.
- **Страница_Inbox**: UI-страница `/inbox` для просмотра и ручного апрува или отклонения Inbox_Fact.
- **Owner_Id**: Идентификатор владельца данных, присутствующий во всех новых таблицах для будущей мультиарендности.
- **Service_Role_Key**: Сервисный ключ Supabase с повышенными правами, используемый только на сервере.

## Requirements

### Requirement 1: Фундамент owner_id в новых таблицах

**User Story:** Как владелец YAS-DT, я хочу, чтобы каждая новая таблица содержала идентификатор владельца, чтобы добавление мультиарендности в будущем не требовало дорогой миграции.

#### Acceptance Criteria

1. THE YAS_DT SHALL define a column `owner_id` of type TEXT in the `inbox_facts` table.
2. THE YAS_DT SHALL define a column `owner_id` of type TEXT in the `ingest_runs` table.
3. WHEN the YAS_DT creates an Inbox_Fact, THE YAS_DT SHALL set the `owner_id` value of that Inbox_Fact to the configured owner identifier.
4. WHEN the YAS_DT creates an Inbox_Run, THE YAS_DT SHALL set the `owner_id` value of that Inbox_Run to the configured owner identifier.
5. WHEN the YAS_DT reads Inbox_Fact records for the Страница_Inbox, THE YAS_DT SHALL return only records whose `owner_id` matches the configured owner identifier.
6. IF no Inbox_Fact record matches the configured owner identifier, THEN THE YAS_DT SHALL return an empty result set.
7. THE Gemini_Classifier SHALL classify a Факт using only the fact text as input, without referencing any hardcoded personal identity value.

### Requirement 2: Единый конфиг словаря сфер и тегов

**User Story:** Как разработчик YAS-DT, я хочу единый источник правды для сфер и тегов, чтобы классификатор, валидатор и UI использовали один список и его можно было заменить источником HPI.

#### Acceptance Criteria

1. THE Конфиг_Словаря SHALL enumerate the eight HPI Сфера values: `loved`, `family`, `friends`, `career`, `physical`, `mental`, `hobby`, `wealth`.
2. THE Конфиг_Словаря SHALL enumerate the allowed Тег values grouped into the controlled vocabularies `type`, `context`, and `stage`.
3. WHEN the Gemini_Classifier validates a Сфера, THE Gemini_Classifier SHALL read the allowed Сфера values from the Конфиг_Словаря.
4. WHEN the Gemini_Classifier validates a Тег, THE Gemini_Classifier SHALL read the allowed Тег values from the Конфиг_Словаря.
5. IF the Конфиг_Словаря is inaccessible during validation, THEN THE Gemini_Classifier SHALL fail the validation and SHALL classify zero Факт records.
6. WHEN the Страница_Inbox displays a Сфера label, THE Страница_Inbox SHALL read the label from the Конфиг_Словаря.
7. WHERE the Конфиг_Словаря is sourced from an external HPI source, THE YAS_DT SHALL expose the same Сфера and Тег value set through the Конфиг_Словаря interface.

### Requirement 3: Контракт выгрузки фактов

**User Story:** Как пользователь, я хочу, чтобы обычный Gemini выдавал факты в устойчивом текстовом формате, чтобы после экспорта в Google Docs формат не ломался автозаменой символов.

#### Acceptance Criteria

1. THE Контракт_Выгрузки SHALL use a header marker line in the form `=== YAS-FACTS <дата> ===` to mark the start of the fact block.
2. THE Контракт_Выгрузки SHALL use the marker line `--- FACT ---` to separate each Факт from the next Факт.
3. THE Контракт_Выгрузки SHALL define a mandatory field `text` containing the fact content for each Факт.
4. THE Контракт_Выгрузки SHALL define optional fields `sphere` and `tags` as classification hints for each Факт.
5. WHEN a Факт block contains exactly one of the optional fields `sphere` or `tags`, THE Парсер_Документа SHALL accept the present optional field and SHALL treat the absent optional field as unset.
6. THE Контракт_Выгрузки SHALL use plain text field markers instead of JSON so that automatic quote substitution in Google_Doc does not invalidate the format.
7. WHEN the Парсер_Документа encounters a Факт block that contains a non-empty `text` field, THE Парсер_Документа SHALL accept that Факт block as valid.
8. IF a Факт block is missing the `text` field or the `text` field is empty, THEN THE Парсер_Документа SHALL reject that Факт block and record a parse error for that Факт block.
9. WHEN a Google_Doc contains zero Факт blocks, THE Парсер_Документа SHALL complete parsing successfully and return zero extracted Факт blocks.

### Requirement 4: Заготовленный промт для Gemini

**User Story:** Как пользователь, я хочу готовый промт для вставки в обычный Gemini, чтобы получить ответ в формате Контракта_Выгрузки и экспортировать его в Google Docs одним тапом.

#### Acceptance Criteria

1. THE YAS_DT SHALL provide a Промт_Выгрузки that instructs Gemini to format new facts according to the Контракт_Выгрузки.
2. THE Промт_Выгрузки SHALL instruct Gemini to name the resulting block with the `YAS-FACTS <дата>` prefix.
3. THE Промт_Выгрузки SHALL instruct Gemini to mark the `text` field as mandatory and the `sphere` and `tags` fields as optional for each Факт.
4. THE YAS_DT SHALL enforce that the `text` field remains mandatory and the `sphere` and `tags` fields remain optional, regardless of any prompt configuration override.
5. WHEN the YAS_DT displays the Промт_Выгрузки, THE YAS_DT SHALL present the Промт_Выгрузки as copyable text.

### Requirement 5: OAuth 2.0 авторизация к Google Drive

**User Story:** Как пользователь, я хочу один раз дать доступ к Google Drive, чтобы YAS-DT мог читать мои документы с фактами без повторного согласия.

#### Acceptance Criteria

1. THE Drive_Connector SHALL request the OAuth 2.0 scope `drive.readonly` during the consent flow.
2. WHEN the user completes the OAuth 2.0 consent flow, THE Drive_Connector SHALL store the received refresh token in the server-side configuration store.
3. WHEN the access token is expired and a refresh token is stored, THE Drive_Connector SHALL obtain a new access token using the stored refresh token without prompting the user for consent.
4. IF the OAuth 2.0 consent flow fails, THEN THE Drive_Connector SHALL return an error response that names the consent failure and SHALL NOT create any Inbox_Fact.
5. IF the stored refresh token is rejected by Google during token refresh, THEN THE Drive_Connector SHALL return an error response that names the re-authorization need and SHALL NOT create any Inbox_Fact.

### Requirement 6: Парсер Google Docs и эндпоинт fetch

**User Story:** Как пользователь, я хочу нажать кнопку «Забрать факты», чтобы YAS-DT нашёл новые документы в Google Drive, разобрал их и поместил факты в очередь на обработку.

#### Acceptance Criteria

1. WHEN the Эндпоинт_Fetch is invoked, THE Drive_Connector SHALL search Google Drive for documents whose name contains the substring `YAS-FACTS`.
2. WHEN the Drive_Connector retrieves a Google_Doc, THE Парсер_Документа SHALL extract each Факт block defined by the Контракт_Выгрузки from the document text.
3. WHEN the Парсер_Документа extracts a valid Факт block, THE Эндпоинт_Fetch SHALL create an Inbox_Fact with `raw_text` set to the `text` field, `suggested_sphere` set to the `sphere` hint, `suggested_tags` set to the `tags` hint, `source_doc_id` set to the Google_Doc identifier, and `status` set to `pending`.
4. IF the Drive search returns no Google_Doc with the `YAS-FACTS` name substring, THEN THE Эндпоинт_Fetch SHALL return a result that reports zero new documents and SHALL create zero Inbox_Fact records.
5. IF a Google_Doc cannot be parsed into any valid Факт block, THEN THE Эндпоинт_Fetch SHALL record a parse error for that Google_Doc and SHALL continue processing the remaining Google_Doc documents.
6. WHEN the Эндпоинт_Fetch completes, THE Эндпоинт_Fetch SHALL create an Inbox_Run that records the count of documents found, the count of Inbox_Fact records created, and the count of parse errors.

### Requirement 7: Идемпотентность обработки документов

**User Story:** Как пользователь, я хочу, чтобы повторное нажатие «Забрать факты» не создавало дубликаты, чтобы один документ не попадал в очередь дважды.

#### Acceptance Criteria

1. THE `inbox_facts` table SHALL store the `source_doc_id` value for each Inbox_Fact.
2. WHEN the Эндпоинт_Fetch processes a Google_Doc whose `source_doc_id` already has associated Inbox_Fact records, THE Эндпоинт_Fetch SHALL skip that Google_Doc and SHALL create zero additional Inbox_Fact records for that Google_Doc.
3. WHEN the Эндпоинт_Fetch skips an already-processed Google_Doc, THE Эндпоинт_Fetch SHALL record the skipped document count in the Inbox_Run.

### Requirement 8: Обработка фактов через Gemini API

**User Story:** Как пользователь, я хочу, чтобы отложенные факты проверялись и классифицировались через Gemini API, чтобы граф наполнялся корректно размеченными узлами.

#### Acceptance Criteria

1. WHEN the Эндпоинт_Process is invoked, THE Эндпоинт_Process SHALL select Inbox_Fact records whose `status` is `pending`.
2. WHEN the Gemini_Classifier processes a pending Inbox_Fact, THE Gemini_Classifier SHALL produce a Сфера, a list of Тег values, and a Confidence value for that Inbox_Fact.
3. WHEN the Gemini_Classifier returns a result for an Inbox_Fact, THE Эндпоинт_Process SHALL store the classification result in the `ai_verdict` field of that Inbox_Fact.
4. THE Эндпоинт_Process SHALL call the Gemini API model `gemini-flash-lite-latest` for classification.
5. WHEN the Эндпоинт_Process completes, THE Эндпоинт_Process SHALL create an Inbox_Run that records the count of Inbox_Fact records processed, inserted, and left pending.
6. IF the Gemini API returns an error response for an Inbox_Fact, THEN THE Эндпоинт_Process SHALL keep that Inbox_Fact with `status` set to `pending` and SHALL record the Gemini API error in the `ai_verdict` field of that Inbox_Fact.
7. IF the Gemini API response cannot be parsed into a classification result, THEN THE Эндпоинт_Process SHALL keep that Inbox_Fact with `status` set to `pending` and SHALL record the parse failure in the `ai_verdict` field of that Inbox_Fact.

### Requirement 9: Порог confidence и решение о вставке

**User Story:** Как пользователь, я хочу, чтобы уверенные и неповторяющиеся факты вставлялись в граф автоматически, а сомнительные ждали моего апрува, чтобы экономить время на очевидном.

#### Acceptance Criteria

1. THE YAS_DT SHALL provide a configurable Порог_Confidence value used by the Эндпоинт_Process.
2. WHEN an Inbox_Fact has a Confidence value greater than or equal to the Порог_Confidence and is not a duplicate, THE Эндпоинт_Process SHALL insert a Факт into the Граф_Знаний and SHALL set the `status` of that Inbox_Fact to `inserted`.
3. WHEN the Эндпоинт_Process inserts a Факт into the Граф_Знаний, THE Эндпоинт_Process SHALL set the `fact_id` of the originating Inbox_Fact to the identifier of the inserted Факт.
4. WHEN an Inbox_Fact has a Confidence value below the Порог_Confidence, THE Эндпоинт_Process SHALL keep the `status` of that Inbox_Fact as `pending`.
5. WHEN the Эндпоинт_Process inserts a Факт into the Граф_Знаний, THE Эндпоинт_Process SHALL set the Сфера and Тег values of that Факт to the values produced by the Gemini_Classifier.

### Requirement 10: Простая дедупликация

**User Story:** Как пользователь, я хочу, чтобы повторяющиеся факты не попадали в граф, чтобы граф не засорялся одинаковыми узлами.

#### Acceptance Criteria

1. WHEN the Дедупликатор compares an Inbox_Fact against the Граф_Знаний, THE Дедупликатор SHALL normalize the fact title or text before comparison.
2. WHEN the normalized text of an Inbox_Fact matches the normalized title or text of an existing Факт in the Граф_Знаний, THE Дедупликатор SHALL classify that Inbox_Fact as a duplicate.
3. WHEN an Inbox_Fact is classified as a duplicate, THE Эндпоинт_Process SHALL keep the `status` of that Inbox_Fact as `pending` indefinitely for audit purposes and SHALL record the duplicate decision in the `ai_verdict` field of that Inbox_Fact.
4. WHEN an Inbox_Fact is classified as a duplicate, THE Эндпоинт_Process SHALL create zero new Факт records in the Граф_Знаний for that Inbox_Fact.

### Requirement 11: Очередь inbox и ручной апрув

**User Story:** Как пользователь, я хочу видеть список отложенных фактов и подтверждать или отклонять их вручную, чтобы контролировать спорные случаи.

#### Acceptance Criteria

1. WHEN the `GET /api/inbox` endpoint is invoked, THE YAS_DT SHALL return the Inbox_Fact records whose `status` is `pending`.
2. WHEN the Страница_Inbox loads, THE Страница_Inbox SHALL display each pending Inbox_Fact with its `raw_text`, `suggested_sphere`, `suggested_tags`, and `ai_verdict`.
3. WHEN the user approves a pending Inbox_Fact on the Страница_Inbox, THE YAS_DT SHALL insert a Факт into the Граф_Знаний and SHALL set the `status` of that Inbox_Fact to `inserted`.
4. WHEN the YAS_DT inserts a Факт from an approved Inbox_Fact, THE YAS_DT SHALL set the `fact_id` of that Inbox_Fact to the identifier of the inserted Факт.
5. WHEN the user rejects a pending Inbox_Fact on the Страница_Inbox, THE YAS_DT SHALL set the `status` of that Inbox_Fact to `rejected` and SHALL create zero Факт records for that Inbox_Fact.
6. WHEN an Inbox_Fact has `status` `inserted` or `rejected`, THE `GET /api/inbox` endpoint SHALL exclude that Inbox_Fact from the pending list.

### Requirement 12: Безопасность токенов и ключей

**User Story:** Как владелец YAS-DT, я хочу, чтобы секреты не утекали к клиенту, чтобы доступ к Drive и базе данных оставался защищённым.

#### Acceptance Criteria

1. THE YAS_DT SHALL store the Google OAuth refresh token only in a server-side store that is not exposed to the browser client.
2. THE YAS_DT SHALL use the Service_Role_Key only in server-side route handlers and SHALL NOT expose the Service_Role_Key to the browser client.
3. WHEN the Drive_Connector or Gemini_Classifier returns an error response to the client, THE YAS_DT SHALL exclude the refresh token, the Service_Role_Key, and the Gemini API key from that error response.
4. WHEN the YAS_DT logs an Inbox_Run, THE YAS_DT SHALL exclude the refresh token, the Service_Role_Key, and the Gemini API key from the logged record.
