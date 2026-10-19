-- Starter Bacii syllabus: 7 subjects, 4 chapters per subject, 4 lessons per chapter.
-- Run after schema.sql on an empty database.
-- To replace existing study data first, run: truncate subjects cascade;

do $$
declare
  data jsonb := $json$
  [
    {"name":"Khmer Literature","color":"#b45309","chapters":[
      "Khmer Poetry and Verse",
      "Reamker and Epic Literature",
      "Modern Khmer Prose",
      "Literary Analysis and Writing"
    ]},
    {"name":"Mathematics","color":"#1d4ed8","chapters":[
      "Limits and Continuity",
      "Derivatives",
      "Integrals",
      "Complex Numbers"
    ]},
    {"name":"Physics","color":"#0e7490","chapters":[
      "Mechanics",
      "Oscillations and Waves",
      "Electricity and Magnetism",
      "Nuclear Physics"
    ]},
    {"name":"Chemistry","color":"#7e22ce","chapters":[
      "Organic Chemistry",
      "Acids and Bases",
      "Kinetics and Equilibrium",
      "Electrochemistry"
    ]},
    {"name":"Biology","color":"#15803d","chapters":[
      "Cell Biology",
      "Genetics",
      "Human Physiology",
      "Ecology and Evolution"
    ]},
    {"name":"History","color":"#9f1239","chapters":[
      "The Angkor Empire",
      "French Protectorate and Independence",
      "The World Wars",
      "Cold War and Modern Cambodia"
    ]},
    {"name":"English","color":"#be185d","chapters":[
      "Grammar Essentials",
      "Reading Comprehension",
      "Writing Skills",
      "Vocabulary and Usage"
    ]}
  ]
  $json$::jsonb;
  subject_record record;
  chapter_record record;
  subject_id uuid;
  chapter_id uuid;
  lesson_index int;
begin
  for subject_record in
    select value, ordinal
    from jsonb_array_elements(data) with ordinality as subjects(value, ordinal)
  loop
    insert into subjects (name, color, sort_order)
    values (
      subject_record.value->>'name',
      subject_record.value->>'color',
      subject_record.ordinal
    )
    returning id into subject_id;

    for chapter_record in
      select value, ordinal
      from jsonb_array_elements_text(subject_record.value->'chapters')
        with ordinality as chapters(value, ordinal)
    loop
      insert into chapters (subject_id, name, sort_order)
      values (subject_id, chapter_record.value, chapter_record.ordinal)
      returning id into chapter_id;

      for lesson_index in 1..4 loop
        insert into lessons (chapter_id, title, sort_order)
        values (
          chapter_id,
          format('%s - Lesson %s', chapter_record.value, lesson_index),
          lesson_index
        );
      end loop;
    end loop;
  end loop;
end $$;
