"use strict"

//Github: https://github.com/foumart/JS.LensFlare

//Blog: http://www.foumartgames.com/blog/6-JavaScript-HTML5-Canvas-Lens-Flare.html

/*
	Lens Flare effect v1.0
	Copyright (c) 2016 by Noncho Savov
   	All rights reserved!

	Redistribution and use in source and binary forms, with or without
	modification, are permitted provided that the following conditions are met:

 	Redistributions of source code must retain the above copyright notice,
	this list of conditions and the following disclaimer.

 	Redistributions in binary form must reproduce the above copyright notice,
	this list of conditions and the following disclaimer in the documentation
	and/or other materials provided with the distribution.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
	AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
	IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
	ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
	LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
	CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
	SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
	INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
	CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
	ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
	POSSIBILITY OF SUCH DAMAGE.
*/
var LensFlare=function(){function g(c,g,A,l,B,t,u,v,w){t||(t="source-over");null==u&&(u=0);null==v&&(v=0);null==w&&(w=1);c.globalAlpha=w;B&&c.clearRect(0,0,A,l);c.globalCompositeOperation=t;c.drawImage(g,u,v)}function l(c,g){var l=document.createElement("canvas");l.width=c;l.height=g;return l}return{init:function(c,G,A,H,B,t){function u(){if(t!=null)t()}function v(e,b,a,y,c,m,d){d=null==d?.3:d/2;var n=l(b,b);n.style.position="absolute";n.style.transform="translate(-"+p[f.length][0]/2+"px, -"+p[f.length][0]/
2+"px)";e.appendChild(n);e=n.getContext("2d");if(m){y=b/2;var g=b/2;e.globalAlpha=null!=c?c:1;e.fillStyle=a[0];e.beginPath();e.moveTo(y+b/2*Math.cos(0),g+b/2*Math.sin(0));for(d=1;d<=m;d+=1)e.lineTo(y+b/2*Math.cos(2*d*Math.PI/m),g+b/2*Math.sin(2*d*Math.PI/m));e.closePath();e.fill()}else{m=e.createRadialGradient(b/2,b/2,b*d,b/2,b/2,b/2);for(d=0;d<a.length;d++)g=7<a[d].length?parseInt(a[d].substr(7,2),16)/255:1,m.addColorStop(y[d],"#"==a[d].charAt(0)?"rgba("+parseInt(a[d].substr(1,2),16)+","+parseInt(a[d].substr(3,
2),16)+","+parseInt(a[d].substr(5,2),16)+","+(null!=c?c:1)*g+")":a[d]);e.fillStyle=m;e.fillRect(0,0,b,b)}return n}function w(e,b,a,c,g,m,d){E=0;var n,l,k,q;m||(a=e+(a-e)/2);m||(c=b+(c-b)/2);k=Math.sqrt((a-e)*(a-e)+(c-b)*(c-b))/(f.length-1);q=[];for(var h=0;h<f.length;h++)n=Math.atan2(a-e,-(c-b)),l=Math.cos(n-Math.PI/2)*h*k,n=Math.sin(n-Math.PI/2)*h*k,f[h].style.left=e+l-p[h][0]/2+"px",f[h].style.top=b+n-p[h][0]/2+"px",f[h].style.opacity=0,q.push({x:e+l,y:b+n});for(h=0;h<f.length;h++)k=f.length-h-
1,TweenLite.to(f[h],g/2,{x:.5*(q[k].x-q[h].x),y:.5*(q[k].y-q[h].y),ease:Power2.easeIn,alpha:1,onComplete:TweenLite.to,onCompleteParams:[f[h],g/2,{x:q[k].x-q[h].x,y:q[k].y-q[h].y,ease:Power2.easeOut,alpha:.75}]});TweenLite.to(x,g,{x:m?0:a-e,y:m?0:c-b,ease:Power2.easeInOut,onUpdate:I,onUpdateParams:[g,d],onComplete:u})}function I(c,b){E++;for(var a=0;a<f.length;a++)g(F,f[a],k,r,!a,"source-over",x._gsTransform.x+parseInt(f[a].style.left)+f[a]._gsTransform.x,x._gsTransform.y+parseInt(f[a].style.top)+
f[a]._gsTransform.y,f[a].style.opacity);g(z,C,k,r,!0);g(z,D,k,r,!1,"lighter")}var z,f,p,D,F,x,C,k,r,E;C=c||l(k,r);k=G;r=A;c=l(k,r);z=c.getContext("2d");g(z,C,k,r,!0);(function(c){function b(){f.push(v(x,p[a][0],p[a][1],p[a][2],p[a][3],p[a][4],p[a][5]));a++;a>=p.length?setTimeout(c,1):b()}x=document.createElement("div");var a=0;f=[];(function(a){p=a;b()})(H||[[18,["#ddffdd","#eeffee","#ddffdd","#ffffff00"],[0,.7,.8,1],.05],[160,"#ffffff00 #0099ff #33ff44 #FFFF00 #FFA500 #ff3333 #dd22aa #cc33ff #ffffff00".split(" "),
[.4,.58,.64,.69,.73,.76,.82,.88,1],.1],[25,["#66ff66","#ccffcc","#ffffff00"],[0,.95,1],.075,0,.1],[125,"#ffffff #ffffff00 #ffffff00 #ffffff #ffffff #ffffff00".split(" "),[0,.1,.5,.85,.9,1],.05,0,.05],[15,["#449944","#55bb55","#66cc66","#ffffff00"],[0,.7,.8,1],.2],[30,["#cc6699","#ff99cc","#ffffff00"],[0,.95,1],.15,0,.1],[90,["#ddddff","#ffffff","#eeeeff","#ffffff00"],[0,.3,.7,1],.06,7],[100,["#ffffff","#ffffff66","#ffffff00"],[0,.5,1],.1,0,0],[12,["#009900","#33ff33","#11cc11","#ffffff00"],[0,.3,
.7,1],.1,8],[75,"#ffffff #ffffffcc #ffffff00 #ffffff00 #ffffff11 #ffffff00 #ffffff88 #ffffff00".split(" "),[0,.15,.2,.5,.7,.75,.9,1],.1,0,0],[35,["#999999","#ffffff","#ffffff00"],[0,.75,1],.075],[20,["#ffffff","#ffffff00"],[0,1],.15,7,.4],[16,["#dddddd","#ffffff","#eeeeee","#ffffff00"],[0,.3,.7,1],.1,7],[150,["#ffffff","#ffffff66","#ffffff00"],[0,.5,1],.2,0,0],[12,"#99bbdd #0099ff #33ff44 #FFFF00 #FFA500 #ff3333 #dd22aa #cc33ff #ffffff00".split(" "),[.2,.68,.74,.79,.83,.86,.92,.98,1],.075],[10,["#dddddd",
"#ffffff","#eeeeee","#ffffff00"],[0,.3,.7,1],.05]])})(function(){B()});D=l(k,r);F=D.getContext("2d");c.play=function(){w.apply(null,arguments)};return c},drawToCanvas:g,generateCanvas:l}}();



/*
	Lens Flare Effect Fiddle
*/

var lensFlareCanvas;

var bgrCanvas = LensFlare.generateCanvas(500, 500);
var bgrContext = bgrCanvas.getContext('2d');

var gradient = bgrContext.createLinearGradient(0, 0, 500, 500);
gradient.addColorStop(0, "#ffb701");
gradient.addColorStop(1, "#f37512");

bgrContext.fillStyle = gradient;
bgrContext.fillRect(0, 0, 500, 500);

lensFlareCanvas = lens.appendChild(LensFlare.init(bgrCanvas, 500, 500, null, lensGenerated));

function lensGenerated(e){
	lensFlareCanvas.play(50, 50, 400, 400, 5);
}
