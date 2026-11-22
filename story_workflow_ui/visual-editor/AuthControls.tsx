import React,{useEffect,useState} from 'react';
export function AuthControls(){
 const [enabled,setEnabled]=useState(false);
 useEffect(()=>{let live=true;fetch('/auth/status').then(r=>r.json()).then(status=>{if(live)setEnabled(status.enabled===true);}).catch(()=>{});return()=>{live=false;};},[]);
 if(!enabled)return null;
 return <form method="post" action="/auth/logout" className="auth-controls"><button className="studio-icon-btn">Đăng xuất</button><a href="/auth/login" target="_blank" rel="noreferrer">Đăng nhập lại</a></form>;
}
