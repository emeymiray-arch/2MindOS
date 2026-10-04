import Link from "next/link";

const UPDATED = "4 октября 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <p className="page-kicker">Документ</p>
        <h1 className="page-title text-[2.2rem] md:text-[2.6rem]">Хранение данных</h1>
        <p className="page-lede">
          Как 2Mind OS хранит данные пользователей. Обновлено {UPDATED}.
        </p>
      </header>

      <section className="panel space-y-3 rise-in">
        <h2 className="text-[1.15rem] font-semibold">Что хранится</h2>
        <ul className="list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-[var(--ink-soft)]">
          <li>логин аккаунта и хеш пароля (сам пароль не сохраняется открытым текстом);</li>
          <li>
            содержимое личного кабинета: цели, планы, задачи, привычки, календарь, финансы, wishlist,
            заметки и настройки профиля;
          </li>
          <li>служебные метки: статус доступа, срок плана (если задан), дата создания аккаунта.</li>
        </ul>
      </section>

      <section className="panel space-y-3 rise-in">
        <h2 className="text-[1.15rem] font-semibold">Где хранятся данные</h2>
        <p className="text-[14px] leading-relaxed text-[var(--ink-soft)]">
          Данные аккаунта хранятся в облачной базе <strong className="text-[var(--ink)]">Supabase</strong>{" "}
          (изолированный снимок на каждый логин). Приложение на Vercel не смешивает кабинеты разных
          пользователей: каждый видит только свой профиль после входа.
        </p>
      </section>

      <section className="panel space-y-3 rise-in">
        <h2 className="text-[1.15rem] font-semibold">Кто имеет доступ</h2>
        <ul className="list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-[var(--ink-soft)]">
          <li>вы — после входа логином и паролем;</li>
          <li>
            администратор сервиса — только для выдачи/паузы доступа и восстановления пароля, не для
            повседневного просмотра вашего кабинета;
          </li>
          <li>данные не продаются и не передаются третьим лицам для рекламы.</li>
        </ul>
      </section>

      <section className="panel space-y-3 rise-in">
        <h2 className="text-[1.15rem] font-semibold">Безопасность</h2>
        <p className="text-[14px] leading-relaxed text-[var(--ink-soft)]">
          Пароли хранятся как односторонний хеш (scrypt). Сессия входа — подписанная cookie. Связь с
          сервером идёт по HTTPS. Рекомендуем не передавать свой пароль другим людям и менять его,
          если доступ мог попасть к посторонним.
        </p>
      </section>

      <section className="panel space-y-3 rise-in">
        <h2 className="text-[1.15rem] font-semibold">Срок и удаление</h2>
        <p className="text-[14px] leading-relaxed text-[var(--ink-soft)]">
          Данные хранятся, пока действует ваш доступ. Чтобы изменить пароль, приостановить кабинет
          или удалить данные — напишите администратору, который выдал вам логин. После удаления
          снимок профиля из облака снимается и больше недоступен для входа.
        </p>
      </section>

      <section className="panel space-y-3 rise-in">
        <h2 className="text-[1.15rem] font-semibold">Согласие при входе</h2>
        <p className="text-[14px] leading-relaxed text-[var(--ink-soft)]">
          Входя в 2Mind OS, вы подтверждаете, что ознакомились с этим документом и согласны на
          хранение данных вашего профиля в описанном порядке.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/" className="btn btn-primary">
          К входу
        </Link>
      </div>
    </div>
  );
}
