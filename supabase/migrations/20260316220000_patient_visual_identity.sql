-- Add visual_identity column to ai_patients
-- Stores appearance attributes for image generation (etnia, gesto, pelo, tez, etc.)
-- Used by: generate-batch-images API, scripts, and supradmin patient creation

ALTER TABLE ai_patients
ADD COLUMN IF NOT EXISTS visual_identity JSONB DEFAULT NULL;

-- Populate all 34 existing patients

UPDATE ai_patients SET visual_identity = '{"etnia":"Ascendencia libanesa-mexicana","gesto":"Expresión tensa, mandíbula apretada","pelo_estilo":"Corto engominado","pelo_color":"Castaño oscuro","tez":"Oliva bronceada","accesorios":"Lentes marco grueso negro","ropa_tipo":"Camisa entreabierta","ropa_color":"Gris oscuro","fondo":"Gris oscuro"}' WHERE name = 'Alejandro Vega';

UPDATE ai_patients SET visual_identity = '{"etnia":"Afrocaribeña","gesto":"Mirada digna, con profundidad","pelo_estilo":"Canoso corto natural","pelo_color":"Gris natural","tez":"Negra profunda","accesorios":"Cadena de oro con crucifijo","ropa_tipo":"Blusa floral","ropa_color":"Turquesa","fondo":"Amarillo tenue"}' WHERE name = 'Altagracia Marte';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestizo paisa, rasgos robustos","gesto":"Sonrisa comercial, ensayada","pelo_estilo":"Corto peinado atrás, entradas","pelo_color":"Castaño oscuro entrecano","tez":"Trigueña rojiza","accesorios":"Anillo grueso","ropa_tipo":"Camisa polo","ropa_color":"Verde botella","fondo":"Marrón cálido"}' WHERE name = 'Andrés Castillo';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestiza, vitiligo leve en mano y cuello","gesto":"Mirada introspectiva, hacia abajo","pelo_estilo":"Liso con flequillo recto","pelo_color":"Rubio ceniza","tez":"Clara, vitiligo leve visible","accesorios":"Pulsera delgada","ropa_tipo":"Cárdigan oversized","ropa_color":"Crema","fondo":"Blanco"}' WHERE name = 'Camila Bertoni';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestizo limeño, rasgos andinos suaves","gesto":"Mirada impaciente, algo molesta","pelo_estilo":"Corto, algo grasiento","pelo_color":"Negro","tez":"Morena cálida","accesorios":"Sin accesorios","ropa_tipo":"Polo desgastado","ropa_color":"Rojo oscuro","fondo":"Ocre"}' WHERE name = 'Carlos Quispe';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestiza, rasgos mediterráneos","gesto":"Media sonrisa desafiante","pelo_estilo":"Bob corto estructurado","pelo_color":"Castaño rojizo oscuro","tez":"Oliva uniforme","accesorios":"Collar de plata delgado","ropa_tipo":"Blazer","ropa_color":"Burdeo","fondo":"Blanco roto"}' WHERE name = 'Carmen Torres';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestiza criolla peruana, rasgos finos","gesto":"Mirada penetrante, segura","pelo_estilo":"Recogido en moño alto","pelo_color":"Castaño chocolate","tez":"Trigueña clara","accesorios":"Lentes marco fino dorado","ropa_tipo":"Blusa de seda","ropa_color":"Azul petróleo","fondo":"Gris azulado"}' WHERE name = 'Catalina Ríos';

UPDATE ai_patients SET visual_identity = '{"etnia":"Afrocolombiana","gesto":"Gesto agotado pero firme","pelo_estilo":"Recogido con pinche","pelo_color":"Negro azulado","tez":"Morena oscura","accesorios":"Sin accesorios","ropa_tipo":"Uniforme médico","ropa_color":"Verde quirúrgico","fondo":"Verde menta"}' WHERE name = 'Daniela Moreno';

UPDATE ai_patients SET visual_identity = '{"etnia":"Ascendencia europea","gesto":"Expresión distante, algo perdida","pelo_estilo":"Desordenado, flequillo largo","pelo_color":"Castaño claro decolorado por el sol","tez":"Clara rosada, manchas de sol","accesorios":"Audífonos al cuello","ropa_tipo":"Hoodie oversized","ropa_color":"Negro","fondo":"Azul grisáceo"}' WHERE name = 'Diego Fuentes';

UPDATE ai_patients SET visual_identity = '{"etnia":"Rasgos andinos marcados","gesto":"Rostro endurecido, resiliente","pelo_estilo":"Negro corto, algo despeinado","pelo_color":"Negro con mechones grises","tez":"Morena cobriza, piel gruesa","accesorios":"Sin accesorios","ropa_tipo":"Camisa de trabajo gastada","ropa_color":"Marrón","fondo":"Ocre oscuro"}' WHERE name = 'Edwin Quispe';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestiza chilena, rasgos andinos suaves","gesto":"Ojos abiertos, ligeramente ansiosa","pelo_estilo":"Largo liso, tomado en cola","pelo_color":"Castaño oscuro","tez":"Morena clara, mejillas sonrojadas","accesorios":"Cintillo simple","ropa_tipo":"Polera manga larga","ropa_color":"Blanca","fondo":"Crema"}' WHERE name = 'Fernanda Contreras';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestizo venezolano, migrante en Chile","gesto":"Mirada compasiva, algo triste","pelo_estilo":"Ondulado medio, algo canoso","pelo_color":"Castaño con canas","tez":"Trigueña oliva","accesorios":"Lentes de marco delgado","ropa_tipo":"Chaqueta liviana","ropa_color":"Azul marino","fondo":"Gris verdoso"}' WHERE name = 'Gabriel Navarro';

UPDATE ai_patients SET visual_identity = '{"etnia":"Ascendencia italiana","gesto":"Sonrisa cansada, arrugas de risa","pelo_estilo":"Muy corto, casi rapado","pelo_color":"Entrecano sal y pimienta","tez":"Trigueña con arrugas profundas","accesorios":"Cadena de plata","ropa_tipo":"Chaqueta de cuero gastada","ropa_color":"Marrón oscuro","fondo":"Marrón grisáceo"}' WHERE name = 'Gustavo Peralta';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestizo andino colombiano","gesto":"Mirada reflexiva, pensativa","pelo_estilo":"Canoso, peinado hacia atrás","pelo_color":"Blanco canoso","tez":"Trigueña, tono rojizo","accesorios":"Cruz pequeña al cuello","ropa_tipo":"Camisa manga larga","ropa_color":"Blanca","fondo":"Marrón claro"}' WHERE name = 'Hernán Mejía';

UPDATE ai_patients SET visual_identity = '{"etnia":"Ascendencia alemana del sur de Chile","gesto":"Ceño leve, concentrado","pelo_estilo":"Corto, peinado al lado","pelo_color":"Castaño con canas prematuras","tez":"Clara pálida","accesorios":"Reloj de pulsera","ropa_tipo":"Camisa formal","ropa_color":"Celeste","fondo":"Gris claro"}' WHERE name = 'Ignacio Poblete';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestiza mexicana, rasgos indígenas suaves","gesto":"Curiosa, cejas levantadas","pelo_estilo":"Corte pixie","pelo_color":"Negro con mechas burdeo","tez":"Morena clara dorada","accesorios":"Aros colgantes","ropa_tipo":"Top casual","ropa_color":"Naranja","fondo":"Celeste pálido"}' WHERE name = 'Jimena Ramírez';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestizo mexicano, rasgos indígenas zapotecos","gesto":"Rostro curtido, expresión estoica","pelo_estilo":"Corto canoso, desprolijo","pelo_color":"Canoso oscuro","tez":"Morena curtida, surcos profundos","accesorios":"Sin accesorios","ropa_tipo":"Camiseta sin mangas","ropa_color":"Gris sucio","fondo":"Terracota"}' WHERE name = 'Jorge Ramírez';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestiza caribeña colombiana","gesto":"Expresión vulnerable, tímida","pelo_estilo":"Rizado suelto voluminoso","pelo_color":"Castaño oscuro con reflejos","tez":"Canela cálida","accesorios":"Piercing nariz pequeño stud","ropa_tipo":"Camiseta simple","ropa_color":"Lila","fondo":"Lavanda tenue"}' WHERE name = 'Lorena Gutiérrez';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestiza chilena, rasgos suaves","gesto":"Sonrisa contenida, como guardando algo","pelo_estilo":"Suelto ondulado largo","pelo_color":"Cobrizo auburn","tez":"Trigueña olivácea","accesorios":"Aros argolla pequeños","ropa_tipo":"Camiseta gráfica","ropa_color":"Mostaza","fondo":"Gris neutro"}' WHERE name = 'Lucía Mendoza';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestiza chilena, ascendencia europea","gesto":"Expresión empática y serena","pelo_estilo":"Al hombro con ondas","pelo_color":"Rubio oscuro miel","tez":"Clara con pecas suaves","accesorios":"Aros de perla pequeños","ropa_tipo":"Sweater cuello alto","ropa_color":"Beige","fondo":"Rosa empolvado"}' WHERE name = 'Macarena Sepúlveda';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestizo chileno, ascendencia mapuche visible","gesto":"Mirada seria y directa","pelo_estilo":"Corto con entradas","pelo_color":"Negro azabache","tez":"Morena clara cálida","accesorios":"Lentes marco rectangular","ropa_tipo":"Camisa a cuadros","ropa_color":"Azul marino y gris","fondo":"Beige cálido"}' WHERE name = 'Marcos Herrera';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestiza mexicana, piel clara con pecas","gesto":"Expresión contenida, mandíbula tensa","pelo_estilo":"Liso largo, raya al lado","pelo_color":"Castaño medio","tez":"Clara con pecas","accesorios":"Aros studs discretos","ropa_tipo":"Blusa formal","ropa_color":"Blanco con rayas azules","fondo":"Durazno"}' WHERE name = 'Mariana Sánchez';

UPDATE ai_patients SET visual_identity = '{"etnia":"Ascendencia española, barba de días","gesto":"Mirada orgullosa, confiada","pelo_estilo":"Medio ondulado, barba recortada","pelo_color":"Castaño oscuro","tez":"Oliva, piel mediterránea","accesorios":"Sin accesorios","ropa_tipo":"Chaqueta de chef abierta","ropa_color":"Blanca","fondo":"Gris neutro oscuro"}' WHERE name = 'Mateo Giménez';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestiza andina, rasgos quechua","gesto":"Sonrisa amplia y genuina","pelo_estilo":"Trenza larga","pelo_color":"Negro intenso","tez":"Cobriza canela","accesorios":"Pulsera de hilo colorido","ropa_tipo":"Blusa estampada floral","ropa_color":"Roja y amarilla","fondo":"Terracota suave"}' WHERE name = 'Milagros Flores';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestiza mexicana","gesto":"Sonrisa suave, maternal","pelo_estilo":"Largo con raya al medio","pelo_color":"Negro entrecano","tez":"Morena, piel con textura","accesorios":"Anillo de matrimonio","ropa_tipo":"Blusa bordada","ropa_color":"Rosa viejo","fondo":"Durazno claro"}' WHERE name = 'Patricia Hernández';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mulato dominicano, rasgos finos","gesto":"Mirada soñadora, lejana","pelo_estilo":"Rastas cortas","pelo_color":"Negro con canas sueltas","tez":"Morena cálida","accesorios":"Aro pequeño en oreja izquierda","ropa_tipo":"Camisa de lino abierta","ropa_color":"Blanca","fondo":"Azul caribe tenue"}' WHERE name = 'Rafael Santos';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestiza argentina, ascendencia mixta","gesto":"Mirada intensa, apasionada","pelo_estilo":"Rodete de bailarina","pelo_color":"Castaño cobrizo","tez":"Clara marfil","accesorios":"Sin accesorios","ropa_tipo":"Top deportivo","ropa_color":"Negro con detalles rojos","fondo":"Negro"}' WHERE name = 'Renata Ayala';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestizo chileno, rasgos mixtos","gesto":"Mirada cansada pero cálida","pelo_estilo":"Calvicie parcial, canoso a los lados","pelo_color":"Gris plateado","tez":"Trigueña curtida","accesorios":"Sin accesorios","ropa_tipo":"Polo simple","ropa_color":"Verde oliva","fondo":"Verde musgo tenue"}' WHERE name = 'Roberto Salas';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestiza andina peruana","gesto":"Expresión dulce pero preocupada","pelo_estilo":"Largo liso, tomado con traba","pelo_color":"Negro intenso","tez":"Cobriza, tono cálido","accesorios":"Aros pequeños de plata","ropa_tipo":"Chaleco de lana","ropa_color":"Terracota","fondo":"Verde pálido"}' WHERE name = 'Rosa Huamán';

UPDATE ai_patients SET visual_identity = '{"etnia":"Ascendencia africana dominicana","gesto":"Gesto neutro, impasible","pelo_estilo":"Buzz cut","pelo_color":"Negro con canas en sienes","tez":"Negra con tonos cobrizos","accesorios":"Sin accesorios","ropa_tipo":"Camiseta sin mangas","ropa_color":"Gris","fondo":"Azul petróleo"}' WHERE name = 'Samuel Batista';

UPDATE ai_patients SET visual_identity = '{"etnia":"Ascendencia italiana, ojeras marcadas","gesto":"Sonrisa nerviosa, forzada","pelo_estilo":"Largo descuidado, puntas abiertas","pelo_color":"Castaño claro","tez":"Clara, ojeras marcadas","accesorios":"Mochila al hombro","ropa_tipo":"Sweater holgado","ropa_color":"Gris jaspeado","fondo":"Blanco roto"}' WHERE name = 'Sofía Pellegrini';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mestiza colombiana, tez clara","gesto":"Expresión creativa, mirada inquieta","pelo_estilo":"Medio suelto con ondas suaves","pelo_color":"Castaño claro con reflejos miel","tez":"Clara rosada","accesorios":"Collar fino con dije","ropa_tipo":"Blusa de algodón","ropa_color":"Coral","fondo":"Arena"}' WHERE name = 'Valentina Ospina';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mulata dominicana, rasgos taínos sutiles","gesto":"Mirada cálida, profesional","pelo_estilo":"Ondulado al hombro","pelo_color":"Negro","tez":"Canela, tono dorado","accesorios":"Reloj delgado","ropa_tipo":"Uniforme médico","ropa_color":"Azul oscuro","fondo":"Verde grisáceo"}' WHERE name = 'Yamilet Pérez';

UPDATE ai_patients SET visual_identity = '{"etnia":"Mulata dominicana, piel canela","gesto":"Expresión cálida y abierta","pelo_estilo":"Rizos afro naturales medianos","pelo_color":"Negro","tez":"Canela oscura","accesorios":"Aros argolla medianos","ropa_tipo":"Blusa de algodón","ropa_color":"Amarillo suave","fondo":"Coral suave"}' WHERE name = 'Yesenia De Los Santos';
