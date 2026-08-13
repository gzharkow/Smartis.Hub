-- Контакты кнопки «Задать вопрос» переехали на Hub.contactMethods
-- (см. миграцию add_hub_contact_methods_and_asset_kinds, куда уже перенесены
-- текущие значения). Это поле больше нигде не читается и не пишется.
ALTER TABLE "Organization" DROP COLUMN "contactMethods";
