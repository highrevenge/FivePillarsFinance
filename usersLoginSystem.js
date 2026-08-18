const USERS="five-pillar-users-v2";
const SESSION="five-pillar-session-v2";
const DATA="five-pillar-user-data-v2:";

function getUsers(){
  try{return JSON.parse(localStorage.getItem(USERS)||"{}")}catch(e){return {}}
}
function email(v){return String(v||"").trim().toLowerCase()}
function hash(v){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}

/* Reads an image file, downsizes it to a small square-ish thumbnail, and
   resolves a compact JPEG data URL — keeps localStorage light per user. */
function readImageResized(file, maxDim){
  return new Promise((resolve, reject)=>{
    if(!file){ resolve(null); return; }
    if(!file.type || file.type.indexOf("image/") !== 0){ reject(new Error("Please choose an image file.")); return; }
    if(file.size > 5*1024*1024){ reject(new Error("Image must be smaller than 5MB.")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that image."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't read that image."));
      img.onload = () => {
        let width = img.width, height = img.height;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById("avatarInput").addEventListener("change", e=>{
  const file = e.target.files[0];
  const preview = document.getElementById("avatarPreview");
  const placeholder = document.getElementById("avatarPlaceholder");
  const msg = document.getElementById("registerMsg");
  msg.textContent = "";
  if(!file){ preview.hidden = true; placeholder.hidden = false; return; }
  if(file.type.indexOf("image/") !== 0){
    msg.textContent = "Please choose an image file.";
    e.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    preview.src = reader.result;
    preview.hidden = false;
    placeholder.hidden = true;
  };
  reader.readAsDataURL(file);
});

document.getElementById("forgotBtn").onclick=()=>{
  document.getElementById("login").hidden=true;
  document.getElementById("register").hidden=true;
  document.getElementById("forgot").hidden=false;
  document.getElementById("loginMsg").textContent="";
};

document.getElementById("backToLoginBtn").onclick=()=>{
  document.getElementById("forgot").hidden=true;
  document.getElementById("register").hidden=true;
  document.getElementById("login").hidden=false;
  document.getElementById("forgotMsg").textContent="";
};

document.getElementById("forgotForm").onsubmit=e=>{
  e.preventDefault();

  const msg=document.getElementById("forgotMsg");
  const mail=email(document.getElementById("forgotEmail").value);
  const newPass=document.getElementById("newPassword").value;
  const confirmPass=document.getElementById("confirmNewPassword").value;
  const users=getUsers();

  if(!users[mail]){
    msg.textContent="No account was found with that email.";
    return;
  }

  if(newPass.length<6){
    msg.textContent="Password must be at least 6 characters.";
    return;
  }

  if(newPass!==confirmPass){
    msg.textContent="Passwords do not match.";
    return;
  }

  users[mail].password=hash(newPass);
  localStorage.setItem(USERS,JSON.stringify(users));

  const changedUser = users[mail];

  msg.textContent="";
  document.getElementById("forgotForm").reset();

  // Show a floating success message with the user's name.
  const toast = document.getElementById("toastMessage");
  toast.innerHTML = '<span class="toast-title">Password Updated</span>' +
    'Successfully changed for <span class="toast-name">' +
    changedUser.name.replace(/[&<>"']/g, function(char){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char];
    }) +
    '</span>.';

  toast.classList.remove("hide");
  toast.classList.add("show");

  setTimeout(()=>{
    toast.classList.add("hide");
  },50);

  setTimeout(()=>{
    toast.classList.remove("show","hide");
  },4200);

  setTimeout(()=>{
    document.getElementById("forgot").hidden=true;
    document.getElementById("login").hidden=false;
    document.getElementById("forgotMsg").textContent="";
  },1200);
};

document.getElementById("registerBtn").onclick=()=>{
  document.getElementById("login").hidden=true;
  document.getElementById("register").hidden=false;
};
document.getElementById("loginBtn").onclick=()=>{
  document.getElementById("register").hidden=true;
  document.getElementById("login").hidden=false;
};

document.getElementById("registerForm").onsubmit=async e=>{
  e.preventDefault();
  const msg=document.getElementById("registerMsg");
  const name=document.getElementById("name").value.trim();
  const mail=email(document.getElementById("regEmail").value);
  const pass=document.getElementById("regPassword").value;
  const confirm=document.getElementById("confirmPassword").value;
  if(pass.length<6){msg.textContent="Password must be at least 6 characters.";return}
  if(pass!==confirm){msg.textContent="Passwords do not match.";return}
  const users=getUsers();
  if(users[mail]){msg.textContent="This email is already registered.";return}

  let avatar=null;
  const avatarFile=document.getElementById("avatarInput").files[0];
  if(avatarFile){
    try{
      avatar=await readImageResized(avatarFile,160);
    }catch(err){
      msg.textContent=err.message;
      return;
    }
  }

  users[mail]={name:name,email:mail,password:hash(pass),avatar:avatar};
  localStorage.setItem(USERS,JSON.stringify(users));
  localStorage.setItem(DATA+mail,JSON.stringify({income:[],savings:[],spending:[],investments:[],protection:[]}));
  localStorage.setItem(SESSION,mail);
  location.href="dashboard.html";
};

document.getElementById("loginForm").onsubmit=e=>{
  e.preventDefault();
  const msg=document.getElementById("loginMsg");
  const mail=email(document.getElementById("email").value);
  const user=getUsers()[mail];
  if(!user || user.password!==hash(document.getElementById("password").value)){
    msg.textContent="Incorrect email or password.";
    return;
  }
  localStorage.setItem(SESSION,mail);
  location.href="dashboard.html";
};

const active=localStorage.getItem(SESSION);
if(active && getUsers()[active]) location.replace("dashboard.html");