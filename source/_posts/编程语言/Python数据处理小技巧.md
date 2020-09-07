---
title: Python数据处理小技巧
date: 2018-08-09 11:24:08
categories: Python
tags:
  - dict
---


### 删除列表中的重复的dict
<!--more-->

```python
[dict(t) for t in set([tuple(d.items()) for d in l])]
```

### dict反转

1. 列表推导

   ```Python
   return dict([(v,k) for k,v in d.iteritems()])
   ```

2. 内置zip

   ```Python
   dict(zip(map(str, d.values()), d.keys()))
   ```

   数据量较大时，可利用`itertools`提高大数据效率

   ```python
   from itertools import izip
   
   dict(izip(d.itervalues(),d.iterkeys()))
   ```
