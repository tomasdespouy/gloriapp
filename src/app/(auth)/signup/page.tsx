import { redirect } from "next/navigation";

// Registro público desactivado. Las cuentas se crean solo desde
// admin/pilotos (con establecimiento asignado), no por autoservicio — así no
// entran cuentas sueltas sin grupo ni visibilidad. Cualquier visita a /signup
// se redirige a /login.
export default function SignupPage() {
  redirect("/login");
}
