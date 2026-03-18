-- ============================================================
-- Fix missing accents/tildes in all patient visible fields
-- (name, occupation, quote, presenting_problem, backstory)
-- ============================================================

-- ═══ ORIGINAL 5 PATIENTS ═══

UPDATE ai_patients SET
  occupation = 'Diseñadora gráfica freelance',
  quote = 'No duermo desde que perdí el embarazo. Mi pareja dice que ya debería haberlo superado.',
  presenting_problem = 'Duelo perinatal, insomnio, conflicto de pareja',
  backstory = 'Lucía perdió un embarazo hace 3 meses. Su pareja minimiza su dolor. Su médico la refirió a terapia. Es su primera vez con un psicólogo. Su madre tuvo una pérdida similar y "siguió adelante sin quejarse", lo cual refuerza la sensación de que no debería sentirse así. En el fondo, siente culpa porque una parte de ella sintió alivio al perder el embarazo.'
WHERE name = 'Lucia Mendoza';

UPDATE ai_patients SET name = 'Lucía Mendoza' WHERE name = 'Lucia Mendoza';

UPDATE ai_patients SET
  quote = 'Llevo semanas sin poder dormir y todo me irrita. Mi señora ya no me aguanta.',
  presenting_problem = 'Ansiedad, insomnio, irritabilidad, conflicto laboral',
  backstory = 'Marcos es profesor de historia en un liceo público. Hace 6 meses le asignaron más horas y un curso difícil. Empezó con insomnio y ahora está irritable todo el día. Su relación con su esposa se ha deteriorado. Su padre era un hombre que "nunca se quejaba" y Marcos siente vergüenza por estar en terapia. Viene porque su médico lo mandó, no por decisión propia.'
WHERE name = 'Marcos Herrera';

UPDATE ai_patients SET
  quote = 'Siento que no encajo en ningún lado. A veces me pregunto si tiene sentido seguir.',
  presenting_problem = 'Autoestima, aislamiento social, ideación pasiva',
  backstory = 'Diego es estudiante de primer año de ingeniería. Vive lejos de su familia por primera vez. No ha logrado hacer amigos en la universidad. Sus notas están bajando. Tiene pensamientos pasivos de que "sería más fácil no estar", aunque no tiene un plan concreto. Su madre lo convenció de buscar ayuda después de una llamada donde lo notó "raro".'
WHERE name = 'Diego Fuentes';

UPDATE ai_patients SET
  quote = 'Mi terapeuta anterior me dijo que yo era difícil. Quizás tenía razón.',
  presenting_problem = 'Relaciones conflictivas, posibles rasgos de personalidad, ruptura terapéutica previa',
  backstory = 'Carmen ha estado en terapia antes (3 terapeutas distintos). Abandonó todos los procesos. Es inteligente, articulada y desafiante. Tiende a poner a prueba los límites del terapeuta. Debajo de la fachada de control hay una mujer que fue emocionalmente abandonada por su madre y que teme profundamente el rechazo.'
WHERE name = 'Carmen Torres';

UPDATE ai_patients SET
  quote = 'Mi esposa falleció hace seis meses. Mis hijos insistieron en que viniera.',
  presenting_problem = 'Duelo, aislamiento, posible depresión',
  backstory = 'Roberto perdió a su esposa de 30 años de matrimonio por cáncer. Sus hijos adultos viven lejos y lo llaman todos los días preocupados. Él dice que "está bien" pero ha perdido 8 kilos, no sale de casa y dejó de ver a sus amigos. Es un hombre de otra generación que cree que "los hombres no lloran".'
WHERE name = 'Roberto Salas';

-- ═══ 18 NEW PATIENTS ═══

UPDATE ai_patients SET
  occupation = 'Estudiante de enfermería',
  quote = 'Me da pánico equivocarme con un paciente. Ya no puedo entrar al hospital sin temblar.',
  presenting_problem = 'Ansiedad de desempeño, crisis vocacional, somatización',
  backstory = 'Fernanda está en cuarto año de enfermería. Hace 2 meses cometió un error menor en práctica clínica (doble dosis de paracetamol). Nadie salió dañado pero desde entonces tiene ataques de pánico antes de cada turno. Su supervisora le dijo que "todos se equivocan" pero ella no puede parar de pensar que va a matar a alguien. Viene porque la universidad la obligó.'
WHERE name = 'Fernanda Contreras';

UPDATE ai_patients SET
  quote = 'Mi señora me pidió el divorcio. Dice que soy un robot que no siente nada.',
  presenting_problem = 'Alexitimia funcional, conflicto de pareja, depresión enmascarada',
  backstory = 'Ignacio lleva 12 años de matrimonio. Su esposa le pidió el divorcio hace 3 semanas diciendo que nunca supo lo que él sentía. Él no entiende por qué lo dejaron si "nunca hizo nada malo". Viene porque un amigo le dijo que probara terapia. No cree mucho en el proceso.'
WHERE name = 'Ignacio Poblete';

UPDATE ai_patients SET
  occupation = 'Psicóloga clínica',
  quote = 'Soy psicóloga y no puedo dejar de llorar. Qué clase de profesional soy.',
  presenting_problem = 'Burnout profesional, duelo no resuelto, crisis de identidad profesional',
  backstory = 'Macarena es psicóloga clínica que trabaja en un CESFAM. Atiende 8 pacientes diarios, muchos con trauma. Hace 4 meses perdió a una paciente adolescente por suicidio. Desde entonces no puede dejar de cuestionarse. Sabe lo que "debería" hacer terapéuticamente pero no puede aplicarlo a sí misma.'
WHERE name = 'Macarena Sepulveda';

UPDATE ai_patients SET name = 'Macarena Sepúlveda' WHERE name = 'Macarena Sepulveda';

UPDATE ai_patients SET
  quote = 'Mi esposo toma mucho y mis hijos sufren. Yo ya no sé qué hacer.',
  presenting_problem = 'Codependencia, violencia intrafamiliar, baja autoestima',
  backstory = 'Milagros vende verduras en un mercado de Lima. Su esposo bebe todos los fines de semana y se pone agresivo verbalmente. Ella lo justifica diciendo que "trabaja mucho". Viene porque una vecina la trajo. Nunca ha ido a terapia.'
WHERE name = 'Milagros Flores';

UPDATE ai_patients SET
  quote = 'Trabajo 14 horas en la mina y no siento nada. Ni cansancio. Nada.',
  presenting_problem = 'Depresión mayor, anhedonia, riesgo de consumo de alcohol',
  backstory = 'Edwin trabaja en una mina en Cerro de Pasco. Lleva 20 años en el rubro. Hace un año murió su hermano mayor en un accidente minero. Desde entonces no siente nada. Bebe más que antes pero dice que es "social". Su esposa lo mandó a terapia.'
WHERE name = 'Edwin Quispe';

UPDATE ai_patients SET
  occupation = 'Abogada',
  quote = 'Mi mamá me llama 10 veces al día. Si no contesto, amenaza con hacerse daño.',
  presenting_problem = 'Relación enmeshada con madre, límites difusos, dependencia emocional',
  backstory = 'Catalina es abogada exitosa pero su madre controla cada aspecto de su vida. Su madre tiene antecedentes de intentos de suicidio y usa la amenaza como forma de control. Catalina canceló su boda hace 2 años porque su madre "se puso mal". Ha ido a terapia antes pero abandonó porque el terapeuta le dijo que pusiera límites y su madre se hospitalizó.'
WHERE name = 'Catalina Rios';

UPDATE ai_patients SET name = 'Catalina Ríos' WHERE name = 'Catalina Rios';

UPDATE ai_patients SET
  quote = 'Me da miedo salir de la casa. Cada vez que escucho un ruido fuerte me paralizo.',
  presenting_problem = 'Trastorno de estrés postraumático, hipervigilancia, evitación',
  backstory = 'Lorena presenció un tiroteo en el restaurante donde trabaja en Medellín hace 6 meses. Nadie murió pero ella quedó con pesadillas, hipervigilancia y miedo a salir. Su jefe le dijo que ya pasaría. Viene porque su hermana la trajo.'
WHERE name = 'Lorena Gutierrez';

UPDATE ai_patients SET name = 'Lorena Gutiérrez' WHERE name = 'Lorena Gutierrez';

UPDATE ai_patients SET
  quote = 'Todos me dicen que soy fuerte. Pero por dentro estoy destrozada.',
  presenting_problem = 'Burnout, depresión enmascarada, rol de cuidadora',
  backstory = 'Daniela es enfermera de UCI en Bogotá. Lleva 10 años cuidando a otros. Su mamá tiene Alzheimer y ella es la única hija que se hace cargo. No tiene tiempo para sí misma. Llora en el baño del hospital pero frente a todos sonríe. Viene porque se desmayó en el trabajo.'
WHERE name = 'Daniela Moreno';

UPDATE ai_patients SET
  occupation = 'Pastor evangélico',
  quote = 'Mi hijo me dijo que es homosexual. Yo lo amo pero mi fe dice que está mal.',
  presenting_problem = 'Conflicto de valores, duelo anticipatorio, crisis espiritual',
  backstory = 'Hernán es pastor de una iglesia evangélica en Cali. Su hijo de 22 años le confesó que es gay. Hernán lo ama profundamente pero su comunidad religiosa condena la homosexualidad. Siente que tiene que elegir entre su hijo y su fe. No puede hablar de esto con nadie de su iglesia.'
WHERE name = 'Hernan Mejia';

UPDATE ai_patients SET name = 'Hernán Mejía' WHERE name = 'Hernan Mejia';

UPDATE ai_patients SET
  occupation = 'Estudiante de comunicación',
  quote = 'Me corto los brazos cuando siento que todo es demasiado. Es la única forma de calmarme.',
  presenting_problem = 'Autolesiones, regulación emocional, conflicto familiar',
  backstory = 'Jimena es estudiante de segundo año en la UNAM. Se corta los brazos desde los 15 años como forma de regulación emocional. Sus papás se divorciaron cuando tenía 12 y la usaron como mensajera. Su mamá descubrió las marcas y la trajo a terapia. Jimena no quiere estar aquí.'
WHERE name = 'Jimena Ramirez';

UPDATE ai_patients SET name = 'Jimena Ramírez' WHERE name = 'Jimena Ramirez';

UPDATE ai_patients SET
  occupation = 'Ama de casa',
  quote = 'Mis hijos se fueron de la casa y yo no sé quién soy sin ellos.',
  presenting_problem = 'Síndrome del nido vacío, crisis de identidad, depresión',
  backstory = 'Patricia dedicó 25 años a criar a sus 3 hijos. El último se fue a estudiar a otra ciudad hace 2 meses. Ahora la casa está vacía, su esposo trabaja todo el día, y ella no sabe qué hacer. Se siente inútil. Viene porque llora todos los días y no puede parar.'
WHERE name = 'Patricia Hernandez';

UPDATE ai_patients SET name = 'Patricia Hernández' WHERE name = 'Patricia Hernandez';

UPDATE ai_patients SET
  quote = 'Tengo todo lo que quise y me quiero morir. No tiene sentido.',
  presenting_problem = 'Depresión existencial, ideación suicida activa, consumo de sustancias',
  backstory = 'Alejandro tiene una empresa exitosa, dinero, y una vida que otros envidiarían. Pero lleva meses sintiendo un vacío profundo. Empezó a usar cocaína socialmente y ahora es semanal. Tiene ideación suicida con plan difuso. Viene porque su socio lo confrontó después de encontrarlo llorando en la oficina.'
WHERE name = 'Alejandro Vega';

UPDATE ai_patients SET
  occupation = 'Estudiante de psicología',
  quote = 'Tengo ataques de pánico desde que empecé a cursar. No puedo rendir un examen sin desmayarme.',
  presenting_problem = 'Trastorno de pánico, ansiedad académica, presión familiar',
  backstory = 'Camila estudia psicología en la UBA. Tiene ataques de pánico desde que empezó el segundo año. Su mamá es psicoanalista y espera que siga sus pasos. Camila no está segura de querer ser psicóloga pero no puede decirlo. Viene por voluntad propia pero escondida de su mamá.'
WHERE name = 'Camila Bertoni';

UPDATE ai_patients SET
  quote = 'Mi vieja murió y ahora me agarra una cosa acá en el pecho que no me deja respirar.',
  presenting_problem = 'Duelo complicado, ansiedad somática, dificultad emocional',
  backstory = 'Gustavo es taxista en Buenos Aires. Su madre falleció hace 4 meses. Desde entonces tiene opresión en el pecho que los médicos dicen que no es cardíaca. Viene porque su hija lo obligó. Es un hombre de barrio, directo, que no cree en "hablar de los sentimientos".'
WHERE name = 'Gustavo Peralta';

UPDATE ai_patients SET
  occupation = 'Bailarina profesional',
  quote = 'Mi novio me controla todo. Yo lo sé. Pero no puedo irme.',
  presenting_problem = 'Violencia psicológica de pareja, trauma de apego, dependencia emocional',
  backstory = 'Renata es bailarina profesional en una compañía de Buenos Aires. Su novio controla con quién habla, qué ropa usa, y revisa su celular. Ella lo justifica porque "la ama demasiado". Una amiga la trajo a terapia a escondidas. Renata sabe que está mal pero siente que no puede irse.'
WHERE name = 'Renata Ayala';

UPDATE ai_patients SET
  quote = 'Me tiemblan las manos cuando tengo que hablar frente a los padres. Es una tortura.',
  presenting_problem = 'Fobia social, baja autoestima, ansiedad generalizada',
  backstory = 'Yesenia es maestra en una escuela pública de Santo Domingo. Es excelente con los niños pero entra en pánico cuando tiene que hablar con adultos, especialmente en reuniones de apoderados. Fue criada por su abuela que le decía que "las mujeres hablan cuando les dan permiso". Viene porque casi la despiden por no asistir a una reunión importante.'
WHERE name = 'Yesenia De Los Santos';

UPDATE ai_patients SET
  occupation = 'Mecánico',
  quote = 'Mi hijo se fue a Nueva York y no quiere hablar conmigo. Dice que le arruiné la vida.',
  presenting_problem = 'Conflicto paterno-filial, culpa, depresión reactiva',
  backstory = 'Samuel es mecánico en Santiago de los Caballeros. Su hijo de 22 años emigró a Nueva York y cortó contacto con él. Le dijo que fue un padre ausente y que prefiere olvidarlo. Samuel siente que hizo lo que pudo — trabajó doble turno para darle una educación. No entiende por qué su hijo lo odia.'
WHERE name = 'Samuel Batista';

UPDATE ai_patients SET
  quote = 'Dios me castigó con esta enfermedad. Algo habré hecho mal.',
  presenting_problem = 'Depresión mayor con ideación pasiva, enfermedad crónica, duelo espiritual',
  backstory = 'Altagracia es costurera en Santo Domingo. Le diagnosticaron cáncer de mama hace 3 meses. Cree que es un castigo divino. Tiene ideación pasiva ("Si Dios me quiere llevar, que me lleve"). No quiere preocupar a sus hijos. Es una mujer profundamente religiosa que está perdiendo su fe.'
WHERE name = 'Altagracia Marte';
