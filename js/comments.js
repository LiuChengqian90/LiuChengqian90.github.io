"use strict";window.addEventListener("tabs:register",function(){var t=CONFIG.comments.activeClass;!(t=CONFIG.comments.storage?localStorage.getItem("comments_active")||t:t)||(t=document.querySelector('a[href="#comment-'.concat(t,'"]')))&&t.click()}),CONFIG.comments.storage&&window.addEventListener("tabs:click",function(t){t.target.matches(".tabs-comment .tab-content .tab-pane")&&(t=t.target.classList[1],localStorage.setItem("comments_active",t))});