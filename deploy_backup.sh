#deploy 
hexo clean
hexo g
hexo d

#backup
hexo clean
git add -A
git commit -m "backup to hexo"
git push origin hexo 
