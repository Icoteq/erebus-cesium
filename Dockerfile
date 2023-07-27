FROM python:3.11

ENV INSTALL /erebus-cesium
ENV START_DATE="2023-07-11T00:00:00+00:00"

WORKDIR $INSTALL
COPY . $INSTALL

RUN pip3 install -r requirements

CMD python3 cesium.py
