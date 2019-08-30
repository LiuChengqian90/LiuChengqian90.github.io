<div id="top"></div>
<script src="https://cdn1.lncld.net/static/js/av-core-mini-0.6.4.js"></script>
<script>AV.initialize("OxuGm1sftgvx1pybK4fNvWEI-gzGzoHsz", "wVNroDGKbkHDfo8jS43cWkzo");</script>
<script type="text/javascript">
  var time=0
  var title=""
  var url=""
  var query = new AV.Query('Counter');
  query.notEqualTo('id',0);
  query.descending('time');
  query.limit(10);
  query.find().then(function (todo) {
    for (var i=0;i<10;i++){
      var result=todo[i].attributes;
      time=result.time;
      title=result.title;
      url=result.url;
      var content="<font color='#555'>"+"【热度："+time+"℃】</font>"+"<a href='"+"https://chengqian90.com"+url+"'>"+title+"</a>"+"<br />";
      document.getElementById("top").innerHTML+=content
    }
  }, function (error) {
    console.log("error");
  });
</script>