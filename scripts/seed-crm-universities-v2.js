// Seed 100 additional LATAM universities (excluding Brazil) into CRM
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const universities = [
  { name: "Universidad Autónoma de Baja California", country: "México", city: "Mexicali", website: "https://www.uabc.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 65000 },
  { name: "Universidad Autónoma de Querétaro", country: "México", city: "Santiago de Querétaro", website: "https://www.uaq.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 28000 },
  { name: "Universidad Autónoma de Yucatán", country: "México", city: "Mérida", website: "https://www.uady.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 25000 },
  { name: "Universidad Autónoma de Chihuahua", country: "México", city: "Chihuahua", website: "https://www.uach.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 30000 },
  { name: "Universidad Autónoma de Sinaloa", country: "México", city: "Culiacán", website: "https://www.uas.edu.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 55000 },
  { name: "Universidad Veracruzana", country: "México", city: "Xalapa", website: "https://www.uv.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 80000 },
  { name: "Universidad Autónoma de Aguascalientes", country: "México", city: "Aguascalientes", website: "https://www.uaa.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 18000 },
  { name: "Universidad de Colima", country: "México", city: "Colima", website: "https://www.ucol.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 16000 },
  { name: "Universidad Autónoma de San Luis Potosí", country: "México", city: "San Luis Potosí", website: "https://www.uaslp.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 30000 },
  { name: "Universidad de Sonora", country: "México", city: "Hermosillo", website: "https://www.unison.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 32000 },
  { name: "Universidad Autónoma de Coahuila", country: "México", city: "Saltillo", website: "https://www.uadec.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 28000 },
  { name: "Universidad Juárez Autónoma de Tabasco", country: "México", city: "Villahermosa", website: "https://www.ujat.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 30000 },
  { name: "Universidad Autónoma de Ciudad Juárez", country: "México", city: "Ciudad Juárez", website: "https://www.uacj.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 29000 },
  { name: "Universidad Autónoma de Nayarit", country: "México", city: "Tepic", website: "https://www.uan.edu.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 18000 },
  { name: "Universidad La Salle México", country: "México", city: "Ciudad de México", website: "https://lasalle.mx", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 10000 },
  { name: "Universidad Panamericana", country: "México", city: "Ciudad de México", website: "https://www.up.edu.mx", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 12000 },
  { name: "Universidad Autónoma de Tlaxcala", country: "México", city: "Tlaxcala", website: "https://www.uatx.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 15000 },
  { name: "Universidad Michoacana de San Nicolás de Hidalgo", country: "México", city: "Morelia", website: "https://www.umich.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 45000 },
  { name: "Universidad Autónoma de Tamaulipas", country: "México", city: "Ciudad Victoria", website: "https://www.uat.edu.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 42000 },
  { name: "Universidad Pontificia Bolivariana", country: "Colombia", city: "Medellín", website: "https://www.upb.edu.co", type: "privada", program_name: "Psicología", estimated_students: 14000 },
  { name: "Universidad Católica de Colombia", country: "Colombia", city: "Bogotá", website: "https://www.ucatolica.edu.co", type: "privada", program_name: "Psicología", estimated_students: 15000 },
  { name: "Universidad Piloto de Colombia", country: "Colombia", city: "Bogotá", website: "https://www.unipiloto.edu.co", type: "privada", program_name: "Psicología", estimated_students: 8000 },
  { name: "Universidad Manuela Beltrán", country: "Colombia", city: "Bogotá", website: "https://umb.edu.co", type: "privada", program_name: "Psicología", estimated_students: 9000 },
  { name: "Universidad Cooperativa de Colombia", country: "Colombia", city: "Bogotá", website: "https://ucc.edu.co", type: "privada", program_name: "Psicología", estimated_students: 55000 },
  { name: "Universidad EAFIT", country: "Colombia", city: "Medellín", website: "https://www.eafit.edu.co", type: "privada", program_name: "Pregrado en Psicología", estimated_students: 12000 },
  { name: "Universidad Santo Tomás", country: "Colombia", city: "Bogotá", website: "https://www.usta.edu.co", type: "privada", program_name: "Psicología", estimated_students: 30000 },
  { name: "Fundación Universitaria Konrad Lorenz", country: "Colombia", city: "Bogotá", website: "https://www.konradlorenz.edu.co", type: "privada", program_name: "Psicología", estimated_students: 4000 },
  { name: "Universidad del Magdalena", country: "Colombia", city: "Santa Marta", website: "https://www.unimagdalena.edu.co", type: "pública", program_name: "Psicología", estimated_students: 18000 },
  { name: "Universidad de Nariño", country: "Colombia", city: "Pasto", website: "https://www.udenar.edu.co", type: "pública", program_name: "Psicología", estimated_students: 12000 },
  { name: "Universidad del Sinú", country: "Colombia", city: "Montería", website: "https://www.unisinu.edu.co", type: "privada", program_name: "Psicología", estimated_students: 8000 },
  { name: "Universidad Externado de Colombia", country: "Colombia", city: "Bogotá", website: "https://www.uexternado.edu.co", type: "privada", program_name: "Psicología", estimated_students: 10000 },
  { name: "Universidad de Palermo", country: "Argentina", city: "Buenos Aires", website: "https://www.palermo.edu", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 12000 },
  { name: "Universidad Abierta Interamericana", country: "Argentina", city: "Buenos Aires", website: "https://uai.edu.ar", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 25000 },
  { name: "Universidad Argentina de la Empresa", country: "Argentina", city: "Buenos Aires", website: "https://www.uade.edu.ar", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 16000 },
  { name: "Universidad Nacional de Cuyo", country: "Argentina", city: "Mendoza", website: "https://www.uncuyo.edu.ar", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 40000 },
  { name: "Universidad Nacional del Comahue", country: "Argentina", city: "Neuquén", website: "https://www.uncoma.edu.ar", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 18000 },
  { name: "Universidad Nacional de San Luis", country: "Argentina", city: "San Luis", website: "https://www.unsl.edu.ar", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 12000 },
  { name: "Universidad Nacional de Entre Ríos", country: "Argentina", city: "Paraná", website: "https://www.uner.edu.ar", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 15000 },
  { name: "Universidad Nacional de San Martín", country: "Argentina", city: "San Martín", website: "https://www.unsam.edu.ar", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 16000 },
  { name: "Universidad Austral", country: "Argentina", city: "Pilar", website: "https://www.austral.edu.ar", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 5000 },
  { name: "Universidad Kennedy", country: "Argentina", city: "Buenos Aires", website: "https://www.kennedy.edu.ar", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 10000 },
  { name: "Universidad de Flores", country: "Argentina", city: "Buenos Aires", website: "https://www.uflo.edu.ar", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 8000 },
  { name: "Universidad Santo Tomás", country: "Chile", city: "Santiago", website: "https://www.ust.cl", type: "privada", program_name: "Psicología", estimated_students: 30000 },
  { name: "Universidad San Sebastián", country: "Chile", city: "Santiago", website: "https://www.uss.cl", type: "privada", program_name: "Psicología", estimated_students: 28000 },
  { name: "Universidad Autónoma de Chile", country: "Chile", city: "Santiago", website: "https://www.uautonoma.cl", type: "privada", program_name: "Psicología", estimated_students: 25000 },
  { name: "Universidad Alberto Hurtado", country: "Chile", city: "Santiago", website: "https://www.uahurtado.cl", type: "privada", program_name: "Psicología", estimated_students: 7000 },
  { name: "Universidad Católica del Norte", country: "Chile", city: "Antofagasta", website: "https://www.ucn.cl", type: "privada", program_name: "Psicología", estimated_students: 12000 },
  { name: "Pontificia Universidad Católica de Valparaíso", country: "Chile", city: "Valparaíso", website: "https://www.pucv.cl", type: "privada", program_name: "Psicología", estimated_students: 16000 },
  { name: "Universidad Central de Chile", country: "Chile", city: "Santiago", website: "https://www.ucentral.cl", type: "privada", program_name: "Psicología", estimated_students: 14000 },
  { name: "Universidad Gabriela Mistral", country: "Chile", city: "Santiago", website: "https://www.ugm.cl", type: "privada", program_name: "Psicología", estimated_students: 5000 },
  { name: "Universidad de los Andes Chile", country: "Chile", city: "Santiago", website: "https://www.uandes.cl", type: "privada", program_name: "Psicología", estimated_students: 7000 },
  { name: "Universidad Finis Terrae", country: "Chile", city: "Santiago", website: "https://www.finisterrae.cl", type: "privada", program_name: "Psicología", estimated_students: 6000 },
  { name: "Universidad Científica del Sur", country: "Perú", city: "Lima", website: "https://www.cientifica.edu.pe", type: "privada", program_name: "Psicología", estimated_students: 15000 },
  { name: "Universidad Privada Norbert Wiener", country: "Perú", city: "Lima", website: "https://www.uwiener.edu.pe", type: "privada", program_name: "Psicología", estimated_students: 20000 },
  { name: "Universidad de San Martín de Porres", country: "Perú", city: "Lima", website: "https://www.usmp.edu.pe", type: "privada", program_name: "Psicología", estimated_students: 35000 },
  { name: "Universidad Ricardo Palma", country: "Perú", city: "Lima", website: "https://www.urp.edu.pe", type: "privada", program_name: "Psicología", estimated_students: 18000 },
  { name: "Universidad Nacional de San Agustín", country: "Perú", city: "Arequipa", website: "https://www.unsa.edu.pe", type: "pública", program_name: "Psicología", estimated_students: 30000 },
  { name: "Universidad Continental", country: "Perú", city: "Huancayo", website: "https://www.continental.edu.pe", type: "privada", program_name: "Psicología", estimated_students: 22000 },
  { name: "Universidad Señor de Sipán", country: "Perú", city: "Chiclayo", website: "https://www.uss.edu.pe", type: "privada", program_name: "Psicología", estimated_students: 15000 },
  { name: "Universidad Privada del Norte", country: "Perú", city: "Trujillo", website: "https://www.upn.edu.pe", type: "privada", program_name: "Psicología", estimated_students: 40000 },
  { name: "Universidad Técnica del Norte", country: "Ecuador", city: "Ibarra", website: "https://www.utn.edu.ec", type: "pública", program_name: "Psicología", estimated_students: 10000 },
  { name: "Universidad Laica Vicente Rocafuerte", country: "Ecuador", city: "Guayaquil", website: "https://www.ulvr.edu.ec", type: "privada", program_name: "Psicología", estimated_students: 8000 },
  { name: "Universidad Tecnológica Indoamérica", country: "Ecuador", city: "Ambato", website: "https://www.uti.edu.ec", type: "privada", program_name: "Psicología", estimated_students: 7000 },
  { name: "Universidad Laica Eloy Alfaro de Manabí", country: "Ecuador", city: "Manta", website: "https://www.uleam.edu.ec", type: "pública", program_name: "Psicología", estimated_students: 12000 },
  { name: "Universidad Técnica de Manabí", country: "Ecuador", city: "Portoviejo", website: "https://www.utm.edu.ec", type: "pública", program_name: "Psicología", estimated_students: 10000 },
  { name: "Universidad APEC", country: "República Dominicana", city: "Santo Domingo", website: "https://www.unapec.edu.do", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 12000 },
  { name: "Universidad Tecnológica de Santiago", country: "República Dominicana", city: "Santiago de los Caballeros", website: "https://www.utesa.edu", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 25000 },
  { name: "Universidad Dominicana O&M", country: "República Dominicana", city: "Santo Domingo", website: "https://www.udoym.edu.do", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 30000 },
  { name: "Universidad de Carabobo", country: "Venezuela", city: "Valencia", website: "https://www.uc.edu.ve", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 40000 },
  { name: "Universidad del Zulia", country: "Venezuela", city: "Maracaibo", website: "https://www.luz.edu.ve", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 50000 },
  { name: "Universidad Metropolitana de Caracas", country: "Venezuela", city: "Caracas", website: "https://www.unimet.edu.ve", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 5000 },
  { name: "Universidad Rafael Belloso Chacín", country: "Venezuela", city: "Maracaibo", website: "https://www.urbe.edu", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 40000 },
  { name: "Universidad Hispanoamericana", country: "Costa Rica", city: "San José", website: "https://uh.ac.cr", type: "privada", program_name: "Psicología", estimated_students: 8000 },
  { name: "Universidad Nacional de Costa Rica", country: "Costa Rica", city: "Heredia", website: "https://www.una.ac.cr", type: "pública", program_name: "Bachillerato en Psicología", estimated_students: 18000 },
  { name: "Universidad de Puerto Rico, Río Piedras", country: "Puerto Rico", city: "San Juan", website: "https://www.uprrp.edu", type: "pública", program_name: "Bachillerato en Psicología", estimated_students: 13000 },
  { name: "Universidad Carlos Albizu", country: "Puerto Rico", city: "San Juan", website: "https://www.albizu.edu", type: "privada", program_name: "Bachillerato en Psicología", estimated_students: 2500 },
  { name: "Universidad del Sagrado Corazón", country: "Puerto Rico", city: "San Juan", website: "https://www.sagrado.edu", type: "privada", program_name: "Bachillerato en Psicología", estimated_students: 5000 },
  { name: "Universidad Interamericana de Puerto Rico", country: "Puerto Rico", city: "San Juan", website: "https://www.inter.edu", type: "privada", program_name: "Bachillerato en Psicología", estimated_students: 40000 },
  { name: "Universidad Ana G. Méndez", country: "Puerto Rico", city: "Gurabo", website: "https://uagm.edu", type: "privada", program_name: "Bachillerato en Psicología", estimated_students: 35000 },
  { name: "Universidad del Norte de Paraguay", country: "Paraguay", city: "Asunción", website: "https://www.uninorte.edu.py", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 8000 },
  { name: "Universidad Columbia del Paraguay", country: "Paraguay", city: "Asunción", website: "https://www.columbia.edu.py", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 6000 },
  { name: "Universidad Autónoma de Asunción", country: "Paraguay", city: "Asunción", website: "https://www.uaa.edu.py", type: "privada", program_name: "Licenciatura en Psicología Clínica", estimated_students: 7000 },
  { name: "Universidad Autónoma Gabriel René Moreno", country: "Bolivia", city: "Santa Cruz de la Sierra", website: "https://www.uagrm.edu.bo", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 80000 },
  { name: "Universidad de Aquino Bolivia", country: "Bolivia", city: "La Paz", website: "https://www.udabol.edu.bo", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 15000 },
  { name: "Universidad Mayor Real y Pontificia de San Francisco Xavier", country: "Bolivia", city: "Sucre", website: "https://www.usfx.bo", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 35000 },
  { name: "Universidad del Valle de Guatemala", country: "Guatemala", city: "Ciudad de Guatemala", website: "https://www.uvg.edu.gt", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 5000 },
  { name: "Universidad Francisco Marroquín", country: "Guatemala", city: "Ciudad de Guatemala", website: "https://www.ufm.edu", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 4000 },
  { name: "Universidad Mesoamericana", country: "Guatemala", city: "Ciudad de Guatemala", website: "https://www.umes.edu.gt", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 8000 },
  { name: "Universidad Católica de Honduras", country: "Honduras", city: "Tegucigalpa", website: "https://www.unicah.edu", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 20000 },
  { name: "Universidad Evangélica de El Salvador", country: "El Salvador", city: "San Salvador", website: "https://www.uees.edu.sv", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 7000 },
  { name: "Universidad Francisco Gavidia", country: "El Salvador", city: "San Salvador", website: "https://www.ufg.edu.sv", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 10000 },
  { name: "Universidad Modular Abierta", country: "El Salvador", city: "San Salvador", website: "https://www.uma.edu.sv", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 6000 },
  { name: "Universidad Americana de Nicaragua", country: "Nicaragua", city: "Managua", website: "https://www.uam.edu.ni", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 5000 },
  { name: "Universidad Nacional Autónoma de Nicaragua, León", country: "Nicaragua", city: "León", website: "https://www.unanleon.edu.ni", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 15000 },
  { name: "Universidad Católica Santa María La Antigua", country: "Panamá", city: "Ciudad de Panamá", website: "https://usma.ac.pa", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 7000 },
  { name: "ISAE Universidad", country: "Panamá", city: "Ciudad de Panamá", website: "https://www.isae.edu.pa", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 6000 },
  { name: "Universidad de Ciencias Médicas de La Habana", country: "Cuba", city: "La Habana", website: "https://www.ucmh.sld.cu", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 20000 },
  { name: "Universidad de Camagüey", country: "Cuba", city: "Camagüey", website: "https://www.reduc.edu.cu", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 10000 },
  { name: "Universidad ORT Uruguay", country: "Uruguay", city: "Montevideo", website: "https://www.ort.edu.uy", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 10000 },
];

async function seed() {
  console.log(`Seeding ${universities.length} additional universities...`);

  const { data, error } = await supabase
    .from("crm_universities")
    .insert(universities.map(u => ({ ...u, status: "prospecto", priority: "media" })))
    .select("id");

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
  console.log(`Successfully seeded ${data.length} universities. Total should now be ~200.`);
}

seed();
