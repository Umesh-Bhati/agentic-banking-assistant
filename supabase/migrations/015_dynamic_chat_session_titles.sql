-- Backfill generic session titles from each conversation's first user message.
update public.chat_sessions as session
set title = coalesce(
  (
    select case
      when char_length(clean.content) <= 60 then clean.content
      else rtrim(left(clean.content, 59), '.,;:!? ') || '…'
    end
    from (
      select trim(regexp_replace(message.content, '\s+', ' ', 'g')) as content
      from public.chat_messages as message
      where message.session_id = session.id
        and message.role = 'user'
        and trim(message.content) <> ''
      order by message.created_at asc, message.id asc
      limit 1
    ) as clean
  ),
  'New Conversation'
)
where session.title is null
   or session.title = 'Banking conversation';
