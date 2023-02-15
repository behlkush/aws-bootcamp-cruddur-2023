# Week 0 — Billing and Architecture





SNS Topic Creation

aws sns subscribe \
    --topic-arn=arn:aws:sns:ca-central-1:342196396576:billing-alarm \
    --protocol=email \
    --notification-endpoint=kushbehl@gmail.com
