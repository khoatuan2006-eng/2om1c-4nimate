import React from 'react';

type Props={children:React.ReactNode;label:string;resetKey?:string;onRetry?:()=>void};
export function ErrorNotice({label,onRetry}:{label:string;onRetry:()=>void}){
 return <div role="alert" className="editor-error" onPointerDown={e=>e.stopPropagation()}><strong>Chưa hiển thị được {label}.</strong><p>Bản dựng đã lưu và các nháp đã giữ vẫn còn. Bạn có thể thử lại hoặc chuyển cảnh.</p><button onClick={onRetry}>Thử lại {label}</button></div>;
}
export class ErrorBoundary extends React.Component<Props,{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidUpdate(previous:Props){if(previous.resetKey!==this.props.resetKey&&this.state.failed)this.setState({failed:false});}
 retry=()=>{this.props.onRetry?.();this.setState({failed:false});};
 render(){return this.state.failed?<ErrorNotice label={this.props.label} onRetry={this.retry}/>:this.props.children;}
}
