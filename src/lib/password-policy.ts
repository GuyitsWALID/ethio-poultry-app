export function passwordPolicyError(password:string){
  if(password.length<12)return "Password must be at least 12 characters.";
  if(!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||!/[^A-Za-z0-9]/.test(password))return "Password must include uppercase, lowercase, a number, and a symbol.";
  return null;
}
