-- 시딩 메시지를 팀원이 어드민에서 직접 고칠 수 있게 한다.
-- 문구가 자주 바뀌는데 지금은 각자 메모장에 들고 있어, 누가 최신인지 알 수 없다.
-- 여러 개를 둘 수 있게 해둔다 (첫 연락 · 재연락 등이 나중에 생길 수 있음).

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null default '',
  sort_order integer not null default 0,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.message_templates enable row level security;

-- 로그인한 팀원이면 누구나 보고 고칠 수 있다.
drop policy if exists message_templates_all on public.message_templates;
create policy message_templates_all on public.message_templates
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.message_templates to authenticated;

-- 지금 쓰고 있는 시딩 문구를 첫 템플릿으로 넣어 둔다.
insert into public.message_templates (name, body, sort_order)
select '시딩 첫 연락', $msg$🎁웰니스 탄산음료 브리보 프리바이오틱 소다🎁
안녕하세요,
프리바이오틱 소다 브랜드 브리보입니다.

브리보는 팔로워분들께 "진정성과 신뢰감"을 함께 만들어갈 인플루언서분들을 모집하고 있습니다.

저희는 탄산음료 업계 최초 "생산 공장을 개방"하며, "전성분까지 모두 공개"합니다.
그만큼 원료와 제조 과정에 자신있으며, 그것이 저희 브랜드의 최대 강점이라고 생각합니다.💪🏻

현재 36만 메가 인플루언서부터, 마켓을 처음 시작하시는 1만명 대의 인플루언서까지 다양한 인플루언서 분들과 협업하고 있습니다.🤝

제품을 체험해 보신 후 마켓 진행 여부를 결정해주셔도 되며, 사전 미팅을 통해 '창업자의 방향성'과 '제품 개발 과정'을 자세히 공유드립니다.✍🏻

아래 제안서 확인 부탁드리며, 궁금하신 점이 있다면 편하게 답변 부탁드립니다!

https://pear-allosaurus-2b4.notion.site/3c117df380b180b6a196e7ebcd88d504?source=copy_link

<따끈따끈한 브리보 최신 소식>
- 9월 그랜드 조선 호텔 납품 확정 🏨
- 10월 AWW 최선정님 기획전 2차 진행 예정 💝
- 11월 올리브영픽(올영픽) 확정 🫒$msg$, 0
where not exists (select 1 from public.message_templates);
