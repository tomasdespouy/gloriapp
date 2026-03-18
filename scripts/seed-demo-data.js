/**
 * SEED DEMO DATA — Simulates a realistic institution with:
 * - 1 institution (Universidad Gabriela Mistral)
 * - 1 admin
 * - 2 instructors (docentes)
 * - 15 students per instructor (30 total)
 * - 3 sessions per student (90 total), 60 min each
 * - All evaluated with V2 competencies
 * - 26 students retroalimentados, 4 pending
 * - Random but realistic data
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env.local") });
const { createClient } = require("@supabase/supabase-js");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ═══ NAME POOLS ═══
const FIRST_NAMES_F = ["Sofia", "Isabella", "Valentina", "Camila", "Martina", "Catalina", "Francisca", "Javiera", "Florencia", "Antonia", "Renata", "Constanza", "Emilia", "Amanda", "Daniela"];
const FIRST_NAMES_M = ["Matias", "Sebastian", "Benjamin", "Vicente", "Tomas", "Nicolas", "Felipe", "Gabriel", "Joaquin", "Martin", "Diego", "Lucas", "Agustin", "Maximiliano", "Santiago"];
const LAST_NAMES = ["González", "Muñoz", "Rojas", "Díaz", "Pérez", "Soto", "Contreras", "Silva", "López", "Morales", "Sepúlveda", "Torres", "Araya", "Flores", "Espinoza", "Vargas", "Figueroa", "Tapia", "Castro", "Bravo"];

function randomName() {
  const isFemale = Math.random() > 0.4;
  const pool = isFemale ? FIRST_NAMES_F : FIRST_NAMES_M;
  const first = pool[Math.floor(Math.random() * pool.length)];
  const last1 = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const last2 = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last1} ${last2}`;
}

function randomFloat(min, max, decimals = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo));
  return d;
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  SEEDING DEMO DATA");
  console.log("═══════════════════════════════════════════\n");

  // 1. Get existing institution (UGM) or create one
  let { data: est } = await admin.from("establishments").select("id").eq("slug", "ugm").single();
  let estId;
  if (est) {
    estId = est.id;
    console.log("Using existing UGM:", estId);
  } else {
    const { data: newEst } = await admin.from("establishments").insert({
      name: "Universidad Gabriela Mistral",
      slug: "ugm",
      country: "Chile",
      is_active: true,
    }).select("id").single();
    estId = newEst.id;
    console.log("Created UGM:", estId);
  }

  // 2. Create course + section
  let { data: course } = await admin.from("courses").select("id").eq("name", "Psicología Clínica I").eq("establishment_id", estId).single();
  let courseId;
  if (course) {
    courseId = course.id;
  } else {
    const { data: newCourse } = await admin.from("courses").insert({
      name: "Psicología Clínica I",
      establishment_id: estId,
    }).select("id").single();
    courseId = newCourse.id;
  }
  console.log("Course:", courseId);

  let sectionIds = [];
  for (const secName of ["Sección A", "Sección B"]) {
    let { data: sec } = await admin.from("sections").select("id").eq("name", secName).eq("course_id", courseId).single();
    if (sec) {
      sectionIds.push(sec.id);
    } else {
      const { data: newSec } = await admin.from("sections").insert({ name: secName, course_id: courseId }).select("id").single();
      sectionIds.push(newSec.id);
    }
  }
  console.log("Sections:", sectionIds);

  // 3. Get active patients
  const { data: patients } = await admin.from("ai_patients").select("id, name").eq("is_active", true).limit(5);
  if (!patients || patients.length === 0) { console.error("No active patients!"); return; }
  console.log("Patients:", patients.map(p => p.name).join(", "));

  // 4. Create 2 instructors
  const instructorIds = [];
  for (let i = 0; i < 2; i++) {
    const name = i === 0 ? "Prof. María Elena Vásquez" : "Prof. Carlos Alberto Mendoza";
    const email = i === 0 ? `demo.instructor1.${Date.now()}@demo.gloria.cl` : `demo.instructor2.${Date.now()}@demo.gloria.cl`;

    const { data: user } = await admin.auth.admin.createUser({
      email,
      password: "Gloria_Demo123",
      email_confirm: true,
      user_metadata: { full_name: name, role: "instructor", establishment_id: estId },
    });
    if (user?.user?.id) {
      await admin.from("profiles").update({
        course_id: courseId,
        section_id: sectionIds[i],
      }).eq("id", user.user.id);
      instructorIds.push(user.user.id);
      console.log(`Instructor ${i + 1}: ${name} (${email})`);
    }
  }

  // 5. Create 30 students (15 per section)
  const studentIds = [];
  const studentNames = [];
  for (let i = 0; i < 30; i++) {
    const sectionIdx = i < 15 ? 0 : 1;
    const name = randomName();
    const email = `demo.student.${i}.${Date.now()}@demo.gloria.cl`;

    const { data: user } = await admin.auth.admin.createUser({
      email,
      password: "Gloria_Demo123",
      email_confirm: true,
      user_metadata: { full_name: name, role: "student", establishment_id: estId },
    });
    if (user?.user?.id) {
      await admin.from("profiles").update({
        course_id: courseId,
        section_id: sectionIds[sectionIdx],
      }).eq("id", user.user.id);
      studentIds.push(user.user.id);
      studentNames.push(name);
    }
  }
  console.log(`\nCreated ${studentIds.length} students`);

  // 6. Create student_progress for each
  for (let i = 0; i < studentIds.length; i++) {
    const sessionsCompleted = 3;
    const xp = 50 + Math.floor(Math.random() * 200);
    const streak = Math.floor(Math.random() * 5);
    await admin.from("student_progress").upsert({
      student_id: studentIds[i],
      level: xp > 300 ? 3 : xp > 100 ? 2 : 1,
      level_name: xp > 300 ? "Terapeuta Jr." : xp > 100 ? "Practicante" : "Observador",
      total_xp: xp,
      sessions_completed: sessionsCompleted,
      current_streak: streak,
      longest_streak: streak + Math.floor(Math.random() * 3),
      last_session_date: new Date().toISOString().split("T")[0],
    }, { onConflict: "student_id" });
  }
  console.log("Student progress created");

  // 7. Create 3 sessions per student (90 conversations)
  console.log("\nCreating 90 sessions...");
  let sessionCount = 0;
  const pendingStudentIndices = [3, 7, 18, 25]; // These 4 won't be approved

  for (let si = 0; si < studentIds.length; si++) {
    const studentId = studentIds[si];
    const isPending = pendingStudentIndices.includes(si);
    const instructorId = si < 15 ? instructorIds[0] : instructorIds[1];

    for (let sess = 1; sess <= 3; sess++) {
      const patientIdx = (si + sess) % patients.length;
      const patient = patients[patientIdx];
      const createdAt = randomDate(21 + (3 - sess) * 7);

      // Create conversation
      const { data: conv } = await admin.from("conversations").insert({
        student_id: studentId,
        ai_patient_id: patient.id,
        session_number: sess,
        status: "completed",
        active_seconds: 3200 + Math.floor(Math.random() * 800), // ~53-67 min
        created_at: createdAt.toISOString(),
      }).select("id").single();

      if (!conv) continue;
      sessionCount++;

      // Create some messages (6-10 turns)
      const turnCount = 6 + Math.floor(Math.random() * 5);
      const messages = [];
      for (let t = 0; t < turnCount; t++) {
        const msgTime = new Date(createdAt.getTime() + t * 240000); // ~4 min apart
        messages.push({
          conversation_id: conv.id,
          role: t % 2 === 0 ? "user" : "assistant",
          content: t % 2 === 0
            ? ["¿Cómo se siente hoy?", "Cuénteme más sobre eso.", "¿Qué emociones le genera?", "Entiendo, debe ser difícil.", "¿Ha hablado con alguien sobre esto?"][t % 5]
            : ["No sé... es complicado.", "[Suspira] A veces me siento abrumado.", "Nadie entiende lo que me pasa.", "Quizás tiene razón, no lo había pensado así.", "[Silencio largo] Es difícil hablar de eso."][t % 5],
          created_at: msgTime.toISOString(),
        });
      }
      await admin.from("messages").insert(messages);

      // V2 Competencies evaluation
      const baseScore = 1.0 + Math.random() * 2.5; // 1.0 - 3.5
      const variation = () => Math.max(0, Math.min(4, baseScore + (Math.random() - 0.5) * 1.5));

      const scores = {
        setting_terapeutico: randomFloat(0.5, 3.5),
        motivo_consulta: randomFloat(0.5, 3.5),
        datos_contextuales: randomFloat(0, 3),
        objetivos: randomFloat(0, 3),
        escucha_activa: variation(),
        actitud_no_valorativa: variation(),
        optimismo: randomFloat(0.5, 3),
        presencia: variation(),
        conducta_no_verbal: randomFloat(0.5, 3),
        contencion_afectos: variation(),
      };
      const activeScores = Object.values(scores).filter(v => v > 0);
      const overallV2 = activeScores.reduce((a, b) => a + b, 0) / activeScores.length;

      const commentary = [
        "El estudiante muestra avances en escucha activa pero necesita trabajar la contención emocional.",
        "Buena exploración del motivo de consulta. El setting fue establecido de forma adecuada.",
        "Se observa mejora progresiva en la alianza terapéutica a lo largo de la sesión.",
        "Necesita fortalecer la presencia terapéutica y reducir las intervenciones directivas.",
        "Excelente manejo del silencio y actitud no valorativa en momentos difíciles.",
      ][Math.floor(Math.random() * 5)];

      const strengths = [
        ["Escucha activa", "Empatía natural"],
        ["Preguntas abiertas", "Rapport inicial"],
        ["Actitud no valorativa", "Presencia"],
        ["Contención emocional", "Exploración del motivo"],
        ["Setting claro", "Objetivos colaborativos"],
      ][Math.floor(Math.random() * 5)];

      const areas = [
        ["Profundizar en datos contextuales", "Evitar directividad"],
        ["Manejar silencios prolongados", "Trabajar confrontación oportuna"],
        ["Formular objetivos más concretos", "Integrar lo no verbal"],
        ["Normalizar emociones", "Mantener presencia constante"],
      ][Math.floor(Math.random() * 4)];

      await admin.from("session_competencies").upsert({
        conversation_id: conv.id,
        student_id: studentId,
        // V2
        setting_terapeutico: parseFloat(scores.setting_terapeutico.toFixed(1)),
        motivo_consulta: parseFloat(scores.motivo_consulta.toFixed(1)),
        datos_contextuales: parseFloat(scores.datos_contextuales.toFixed(1)),
        objetivos: parseFloat(scores.objetivos.toFixed(1)),
        escucha_activa: parseFloat(scores.escucha_activa.toFixed(1)),
        actitud_no_valorativa: parseFloat(scores.actitud_no_valorativa.toFixed(1)),
        optimismo: parseFloat(scores.optimismo.toFixed(1)),
        presencia: parseFloat(scores.presencia.toFixed(1)),
        conducta_no_verbal: parseFloat(scores.conducta_no_verbal.toFixed(1)),
        contencion_afectos: parseFloat(scores.contencion_afectos.toFixed(1)),
        overall_score_v2: parseFloat(overallV2.toFixed(1)),
        eval_version: 2,
        // Legacy V1 mapped
        empathy: parseFloat(scores.escucha_activa.toFixed(1)),
        active_listening: parseFloat(scores.escucha_activa.toFixed(1)),
        open_questions: parseFloat(scores.motivo_consulta.toFixed(1)),
        reformulation: parseFloat(scores.datos_contextuales.toFixed(1)),
        confrontation: parseFloat(scores.actitud_no_valorativa.toFixed(1)),
        silence_management: parseFloat(scores.presencia.toFixed(1)),
        rapport: parseFloat(scores.contencion_afectos.toFixed(1)),
        overall_score: parseFloat((overallV2 * 2.5).toFixed(1)), // Scale to 0-10
        ai_commentary: commentary,
        strengths: strengths,
        areas_to_improve: areas,
        feedback_status: isPending ? "pending" : "approved",
        ...(isPending ? {} : {
          approved_by: instructorId,
          approved_at: new Date().toISOString(),
        }),
      }, { onConflict: "conversation_id" });

      // Teacher feedback (only for approved ones)
      if (!isPending) {
        const teacherComments = [
          "Buen trabajo en esta sesión. Se nota evolución desde la sesión anterior.",
          "El estudiante está desarrollando mayor sensibilidad clínica.",
          "Necesita practicar más la formulación de objetivos terapéuticos.",
          "Excelente manejo de la alianza terapéutica. Seguir así.",
          "Se recomienda revisar el módulo de contención de afectos.",
        ];
        await admin.from("session_feedback").upsert({
          conversation_id: conv.id,
          student_id: studentId,
          teacher_id: instructorId,
          teacher_comment: teacherComments[Math.floor(Math.random() * teacherComments.length)],
          teacher_score: randomFloat(4, 9),
          discomfort_moment: Math.random() > 0.5 ? "Cuando el paciente se puso a llorar" : null,
          would_redo: Math.random() > 0.5 ? "Habría esperado más antes de intervenir" : null,
        }, { onConflict: "conversation_id" });
      }

      process.stdout.write(".");
    }
  }

  console.log(`\n\nSessions created: ${sessionCount}`);
  console.log("\n═══════════════════════════════════════════");
  console.log("  DEMO DATA COMPLETE");
  console.log("═══════════════════════════════════════════");
  console.log(`\n  Institution: Universidad Gabriela Mistral`);
  console.log(`  Course: Psicología Clínica I`);
  console.log(`  Sections: Sección A, Sección B`);
  console.log(`  Instructors: 2`);
  console.log(`  Students: ${studentIds.length}`);
  console.log(`  Sessions: ${sessionCount}`);
  console.log(`  Pending review: 4 students (indices ${pendingStudentIndices.join(",")})`);
  console.log(`  Approved: ${studentIds.length - 4} students`);
}

main().catch(e => { console.error(e); process.exit(1); });
